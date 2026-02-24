package com.pathwise.backend.service;

import com.pathwise.backend.exception.UserNotFoundException;
import com.pathwise.backend.model.*;
import com.pathwise.backend.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class PlaidService {

    private final UserRepository userRepository;
    private final AccountRepository accountRepository;
    private final TransactionRepository transactionRepository;
    private final TransactionCategoryRepository categoryRepository;
    private final RestTemplate restTemplate;
    private final AICategorizationService aiCategorizationService;

    @Value("${plaid.client-id}")
    private String clientId;

    @Value("${plaid.secret}")
    private String plaidSecret;

    @Value("${plaid.env}")
    private String plaidEnv;

    private String getPlaidBaseUrl() {
        return switch (plaidEnv) {
            case "production" -> "https://production.plaid.com";
            case "development" -> "https://development.plaid.com";
            default -> "https://sandbox.plaid.com";
        };
    }

    private User getCurrentUser() {
        UserDetails userDetails = (UserDetails) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        return userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new UserNotFoundException("User not found"));
    }

    // ── Step 1: Create Link Token (frontend uses this to open Plaid UI) ──
    public String createLinkToken() {
        User user = getCurrentUser();

        log.info("DEBUG - clientId: '{}'", clientId);
        log.info("DEBUG - secret: '{}'", plaidSecret);
        log.info("DEBUG - env: '{}'", plaidEnv);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> body = new HashMap<>();
        body.put("client_id", clientId);
        body.put("secret", plaidSecret);
        body.put("client_name", "PathWise");
        body.put("country_codes", List.of("US"));
        body.put("language", "en");
        body.put("user", Map.of("client_user_id", user.getId().toString()));
        body.put("products", List.of("transactions"));

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

        try {
            Map response = restTemplate.postForObject(
                    getPlaidBaseUrl() + "/link/token/create",
                    request, Map.class);
            return (String) response.get("link_token");
        } catch (Exception e) {
            log.error("Failed to create Plaid link token: {}", e.getMessage());
            throw new RuntimeException("Failed to connect to Plaid. Please try again.");
        }
    }

    // ── Step 2: Exchange public token for access token & save account ──
    public void exchangeTokenAndSave(String publicToken, String institutionName) {
        User user = getCurrentUser();

        // One account per user — check if already linked
        if (accountRepository.findByUserId(user.getId()).isPresent()) {
            throw new IllegalStateException(
                    "You already have a bank account linked. Please remove it before adding a new one.");
        }

        // Exchange public token for access token
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> body = new HashMap<>();
        body.put("client_id", clientId);
        body.put("secret", plaidSecret);
        body.put("public_token", publicToken);

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

        try {
            Map response = restTemplate.postForObject(
                    getPlaidBaseUrl() + "/item/public_token/exchange",
                    request, Map.class);

            String accessToken = (String) response.get("access_token");

            // Fetch account details from Plaid
            Map<String, Object> accountsBody = new HashMap<>();
            accountsBody.put("client_id", clientId);
            accountsBody.put("secret", plaidSecret);
            accountsBody.put("access_token", accessToken);

            Map accountsResponse = restTemplate.postForObject(
                    getPlaidBaseUrl() + "/accounts/get",
                    new HttpEntity<>(accountsBody, headers), Map.class);

            List<Map> accounts = (List<Map>) accountsResponse.get("accounts");
            if (accounts.isEmpty()) {
                throw new RuntimeException("No accounts found from Plaid");
            }
            
            Map firstAccount = accounts.get(0); // One account per user

            Map balances = (Map) firstAccount.get("balances");
            
            // FIX: Handle both Integer and Double from Plaid for balance
            Object balanceObj = balances.get("current");
            Double currentBalance = null;
            if (balanceObj != null) {
                if (balanceObj instanceof Number) {
                    currentBalance = ((Number) balanceObj).doubleValue();
                } else {
                    currentBalance = Double.parseDouble(balanceObj.toString());
                }
            }
            
            String mask = (String) firstAccount.get("mask");
            String accountType = (String) firstAccount.get("type");

            Account account = Account.builder()
                    .user(user)
                    .plaidAccountId((String) firstAccount.get("account_id"))
                    .bankName(institutionName)
                    .accountType(accountType)
                    .balance(currentBalance != null ?
                            BigDecimal.valueOf(currentBalance) : BigDecimal.ZERO)
                    .currency("BHD")
                    .maskedNumber(mask != null ? "****" + mask : null)
                    .createdAt(LocalDateTime.now())
                    .build();

            accountRepository.save(account);
            log.info("Account saved successfully with ID: {}", account.getId());

            // Immediately fetch and store transactions
            fetchAndStoreTransactions(accessToken, account);

        } catch (Exception e) {
            log.error("Failed to exchange token: {}", e.getMessage());
            throw new RuntimeException("Failed to link bank account: " + e.getMessage());
        }
    }

    // ── Step 3: Fetch transactions from Plaid and save to DB ──
    public void fetchAndStoreTransactions(String accessToken, Account account) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        LocalDate endDate = LocalDate.now();
        LocalDate startDate = endDate.minusMonths(3); // Last 3 months

        Map<String, Object> body = new HashMap<>();
        body.put("client_id", clientId);
        body.put("secret", plaidSecret);
        body.put("access_token", accessToken);
        body.put("start_date", startDate.toString());
        body.put("end_date", endDate.toString());

        try {
            Map response = restTemplate.postForObject(
                    getPlaidBaseUrl() + "/transactions/get",
                    new HttpEntity<>(body, headers), Map.class);

            List<Map> transactions = (List<Map>) response.get("transactions");

            int savedCount = 0;
            for (Map txn : transactions) {
                String plaidTxnId = (String) txn.get("transaction_id");

                // Skip duplicates
                if (transactionRepository.existsByPlaidTransactionId(plaidTxnId)) {
                    continue;
                }

                String merchantName = (String) txn.getOrDefault("merchant_name",
                        txn.getOrDefault("name", "Unknown"));

                // FIX: Handle both Integer and Double from Plaid for amount
                Object amountObj = txn.get("amount");
                Double amountRaw = null;
                if (amountObj != null) {
                    if (amountObj instanceof Number) {
                        amountRaw = ((Number) amountObj).doubleValue();
                    } else {
                        amountRaw = Double.parseDouble(amountObj.toString());
                    }
                }
                
                BigDecimal amount = amountRaw != null ?
                        BigDecimal.valueOf(Math.abs(amountRaw)) : BigDecimal.ZERO;

                // Plaid: positive = debit (money out), negative = credit (money in)
                String type = amountRaw != null && amountRaw > 0 ? "DEBIT" : "CREDIT";

                String dateStr = (String) txn.get("date");
                LocalDate txnDate = LocalDate.parse(dateStr);

                // AI categorization
                String categoryName = aiCategorizationService.categorize(merchantName, amount);
                TransactionCategory category = getOrCreateCategory(categoryName);

                Transaction transaction = Transaction.builder()
                        .account(account)
                        .category(category)
                        .plaidTransactionId(plaidTxnId)
                        .merchantName(merchantName)
                        .amount(amount)
                        .type(com.pathwise.backend.enums.TransactionType.valueOf(type))
                        .currency("BHD")
                        .transactionDate(txnDate)
                        .aiCategoryRaw(categoryName)
                        .createdAt(LocalDateTime.now())
                        .build();

                transactionRepository.save(transaction);
                savedCount++;
            }
            log.info("Saved {} new transactions for account {}", savedCount, account.getId());
            
        } catch (Exception e) {
            log.error("Failed to fetch transactions: {}", e.getMessage());
            throw new RuntimeException("Failed to fetch transactions: " + e.getMessage());
        }
    }

    private TransactionCategory getOrCreateCategory(String name) {
        return categoryRepository.findByName(name)
                .orElseGet(() -> categoryRepository.save(
                        TransactionCategory.builder()
                                .name(name)
                                .icon(getCategoryIcon(name))
                                .colorHex(getCategoryColor(name))
                                .build()
                ));
    }

    private String getCategoryIcon(String category) {
        return switch (category.toUpperCase()) {
            case "FOOD & DINING" -> "🍔";
            case "TRANSPORT" -> "🚗";
            case "SHOPPING" -> "🛍️";
            case "ENTERTAINMENT" -> "🎬";
            case "HEALTH" -> "🏥";
            case "UTILITIES" -> "💡";
            case "EDUCATION" -> "📚";
            case "TRAVEL" -> "✈️";
            default -> "💳";
        };
    }

    private String getCategoryColor(String category) {
        return switch (category.toUpperCase()) {
            case "FOOD & DINING" -> "#FF6B6B";
            case "TRANSPORT" -> "#4ECDC4";
            case "SHOPPING" -> "#45B7D1";
            case "ENTERTAINMENT" -> "#96CEB4";
            case "HEALTH" -> "#FFEAA7";
            case "UTILITIES" -> "#DDA0DD";
            default -> "#95A5A6";
        };
    }
}