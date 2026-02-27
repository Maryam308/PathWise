package com.pathwise.backend.service;

import com.pathwise.backend.dto.LinkCardRequest;
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
import java.math.RoundingMode;
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

    // List of Plaid sandbox institutions with different merchant data
    private static final List<String> INSTITUTIONS = Arrays.asList(
        "ins_3",  // Chase - Uber, McDonald's, Starbucks
        "ins_5",  // Wells Fargo - Amazon, Walmart, Netflix
        "ins_4",  // Citibank - Zara, H&M, Careem
        "ins_6",  // Bank of America - CVS, Walgreens, Apple
        "ins_1",  // US Bank - Shell, Exxon, Delta
        "ins_2"   // PNC - Target, Best Buy, Spotify
    );
    
    private static final Map<String, String> INSTITUTION_NAMES = Map.of(
        "ins_3", "Chase",
        "ins_5", "Wells Fargo",
        "ins_4", "Citibank",
        "ins_6", "Bank of America",
        "ins_1", "US Bank",
        "ins_2", "PNC"
    );
    
    private static final Random RANDOM = new Random();
    
    // USD to BHD conversion rate (1 USD = 0.376 BHD)
    private static final BigDecimal USD_TO_BHD = new BigDecimal("0.376");

    private String getRandomInstitution() {
        return INSTITUTIONS.get(RANDOM.nextInt(INSTITUTIONS.size()));
    }

    private String getPlaidBaseUrl() {
        return switch (plaidEnv) {
            case "production" -> "https://production.plaid.com";
            case "development" -> "https://development.plaid.com";
            default -> "https://sandbox.plaid.com";
        };
    }

    // ── FULL PLAID FLOW METHODS ──

    public String createLinkToken() {
        User user = getCurrentUser();

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
            log.info("Creating link token for user {}", user.getId());
            Map response = restTemplate.postForObject(
                    getPlaidBaseUrl() + "/link/token/create",
                    request, Map.class);
            String linkToken = (String) response.get("link_token");
            log.info("✅ Link token created successfully");
            return linkToken;
        } catch (Exception e) {
            log.error("Failed to create link token: {}", e.getMessage());
            throw new RuntimeException("Failed to create Plaid link token");
        }
    }

    public void exchangeTokenAndSave(String publicToken, String bankId, String institutionName) {
        User user = getCurrentUser();

        if (accountRepository.findByUserId(user.getId()).isPresent()) {
            throw new IllegalStateException(
                    "You already have a bank account linked. Remove it before adding a new one.");
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> body = Map.of(
                "client_id", clientId,
                "secret", plaidSecret,
                "public_token", publicToken
        );

        log.info("Exchanging public token for access token...");
        Map response = restTemplate.postForObject(
                getPlaidBaseUrl() + "/item/public_token/exchange",
                new HttpEntity<>(body, headers), Map.class);

        String accessToken = (String) response.get("access_token");
        String itemId = (String) response.get("item_id");
        log.info("✅ Access token obtained successfully for item: {}", itemId);

        Map<String, Object> accountsBody = Map.of(
                "client_id", clientId,
                "secret", plaidSecret,
                "access_token", accessToken
        );

        Map accountsResponse = restTemplate.postForObject(
                getPlaidBaseUrl() + "/accounts/get",
                new HttpEntity<>(accountsBody, headers), Map.class);

        List<Map> accounts = (List<Map>) accountsResponse.get("accounts");
        if (accounts.isEmpty()) {
            throw new RuntimeException("No accounts found from Plaid");
        }
        
        Map plaidAccount = accounts.get(0);
        Map balances = (Map) plaidAccount.get("balances");
        BigDecimal balance = extractAmount(balances.get("current"));

        com.pathwise.backend.enums.BahrainBank bank = 
                com.pathwise.backend.enums.BahrainBank.valueOf(bankId);

        Account account = Account.builder()
                .user(user)
                .plaidAccountId((String) plaidAccount.get("account_id"))
                .plaidAccessToken(accessToken)
                .bank(bank)
                .bankName(bank.getDisplayName())
                .accountType((String) plaidAccount.get("type"))
                .balance(balance)
                .currency("BHD")
                .createdAt(LocalDateTime.now())
                .build();

        accountRepository.save(account);
        log.info("✅ Account saved for user {} with bank: {}", user.getId(), bank.getDisplayName());

        fetchAndStoreTransactions(accessToken, account);
    }

    public void linkCard(LinkCardRequest request) {
        User user = getCurrentUser();

        if (accountRepository.findByUserId(user.getId()).isPresent()) {
            throw new IllegalStateException(
                    "You already have a bank account linked. Remove it before adding a new one.");
        }

        // ===== RANDOM INSTITUTION SELECTION =====
        String randomInstitution = getRandomInstitution();
        String institutionDisplayName = INSTITUTION_NAMES.get(randomInstitution);
        log.info("🎲 Selected random institution: {} ({}) for user {}", 
                 randomInstitution, institutionDisplayName, user.getId());
        
        String publicToken = createSandboxPublicToken(randomInstitution);
        String accessToken = exchangePublicToken(publicToken);

        Map plaidAccount = getPlaidAccount(accessToken);
        Map balances = (Map) plaidAccount.get("balances");
        BigDecimal balance = extractAmount(balances.get("current"));

        Account account = Account.builder()
                .user(user)
                .plaidAccountId((String) plaidAccount.get("account_id"))
                .plaidAccessToken(accessToken)
                .bank(request.getBank())
                .cardType(request.getCardType())
                .cardHolderName(request.getCardHolderName())
                .maskedNumber("****" + request.getLastFourDigits())
                .expiryMonth(request.getExpiryMonth())
                .expiryYear(request.getExpiryYear())
                .bankName(request.getBank().getDisplayName())
                .accountType(request.getCardType().name().toLowerCase())
                .balance(balance)
                .currency("BHD")
                .createdAt(LocalDateTime.now())
                .build();

        accountRepository.save(account);
        log.info("✅ Card linked for user {}: {} (using random Plaid institution: {} - {})", 
                user.getId(), request.getBank().getDisplayName(), 
                randomInstitution, institutionDisplayName);

        try {
            log.info("Waiting 5 seconds for transactions to be ready...");
            Thread.sleep(5000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        fetchAndStoreTransactions(accessToken, account);
    }

    public void syncTransactions() {
        User user = getCurrentUser();
        Account account = accountRepository.findByUserId(user.getId())
                .orElseThrow(() -> new IllegalStateException("No linked account found"));

        if (account.getPlaidAccessToken() == null) {
            throw new IllegalStateException("No Plaid access token for this account");
        }
        fetchAndStoreTransactions(account.getPlaidAccessToken(), account);
    }

    private String createSandboxPublicToken(String institutionId) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> body = Map.of(
                "client_id", clientId,
                "secret", plaidSecret,
                "institution_id", institutionId,
                "initial_products", List.of("transactions")
        );

        try {
            String institutionName = INSTITUTION_NAMES.getOrDefault(institutionId, "Unknown");
            log.info("Creating sandbox public token with institution: {} ({})", institutionId, institutionName);
            Map response = restTemplate.postForObject(
                    getPlaidBaseUrl() + "/sandbox/public_token/create",
                    new HttpEntity<>(body, headers), Map.class);
            String publicToken = (String) response.get("public_token");
            log.info("✅ Sandbox public token created successfully");
            return publicToken;
        } catch (Exception e) {
            log.error("Failed to create sandbox token: {}", e.getMessage());
            throw new RuntimeException("Failed to connect to Plaid sandbox");
        }
    }

    private String exchangePublicToken(String publicToken) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> body = Map.of(
                "client_id", clientId,
                "secret", plaidSecret,
                "public_token", publicToken
        );

        log.info("Exchanging public token for access token...");
        Map response = restTemplate.postForObject(
                getPlaidBaseUrl() + "/item/public_token/exchange",
                new HttpEntity<>(body, headers), Map.class);
        String accessToken = (String) response.get("access_token");
        log.info("✅ Access token obtained successfully");
        return accessToken;
    }

    private Map getPlaidAccount(String accessToken) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> body = Map.of(
                "client_id", clientId,
                "secret", plaidSecret,
                "access_token", accessToken
        );

        Map response = restTemplate.postForObject(
                getPlaidBaseUrl() + "/accounts/get",
                new HttpEntity<>(body, headers), Map.class);

        List<Map> accounts = (List<Map>) response.get("accounts");
        if (accounts == null || accounts.isEmpty()) {
            throw new RuntimeException("No accounts found from Plaid");
        }
        return accounts.get(0);
    }

    public void fetchAndStoreTransactions(String accessToken, Account account) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        LocalDate end = LocalDate.now();
        LocalDate start = end.minusMonths(3);

        Map<String, Object> body = Map.of(
                "client_id", clientId,
                "secret", plaidSecret,
                "access_token", accessToken,
                "start_date", start.toString(),
                "end_date", end.toString()
        );

        try {
            log.info("Fetching transactions from Plaid for account: {}", account.getId());
            Map response = restTemplate.postForObject(
                    getPlaidBaseUrl() + "/transactions/get",
                    new HttpEntity<>(body, headers), Map.class);

            List<Map> transactions = (List<Map>) response.get("transactions");
            
            // Prepare transactions for batch processing
            List<Map<String, Object>> batchForAI = new ArrayList<>();
            Map<String, Map> rawTransactions = new HashMap<>();
            Map<String, BigDecimal> bhdAmounts = new HashMap<>();
            
            for (Map txn : transactions) {
                String plaidTxnId = (String) txn.get("transaction_id");
                if (transactionRepository.existsByPlaidTransactionId(plaidTxnId)) continue;

                String merchantName = (String) txn.get("merchant_name");
                
                // Convert amount from USD to BHD
                BigDecimal usdAmount = extractAmount(txn.get("amount"));
                BigDecimal bhdAmount = usdAmount.multiply(USD_TO_BHD).setScale(3, RoundingMode.HALF_UP);
                
                // Store data for later use
                bhdAmounts.put(plaidTxnId, bhdAmount);
                
                // ONLY use merchant name for AI if it exists and is not null
                if (merchantName != null && !merchantName.trim().isEmpty()) {
                    Map<String, Object> txnInfo = new HashMap<>();
                    txnInfo.put("id", plaidTxnId);
                    txnInfo.put("merchantName", merchantName);
                    txnInfo.put("amount", bhdAmount);
                    
                    batchForAI.add(txnInfo);
                }
                
                rawTransactions.put(plaidTxnId, txn);
            }
            
            if (batchForAI.isEmpty() && rawTransactions.isEmpty()) {
                log.info("No new transactions to process");
                return;
            }
            
            log.info("Processing {} transactions with merchant names via batch AI", batchForAI.size());
            log.info("Total new transactions: {}", rawTransactions.size());
            
            // Process merchant names with AI in batches
            Map<String, String> aiCategories = new HashMap<>();
            
            if (!batchForAI.isEmpty()) {
                // Process in batches of 15 to be safe with token limits
                int batchSize = 15;
                for (int i = 0; i < batchForAI.size(); i += batchSize) {
                    int endIdx = Math.min(i + batchSize, batchForAI.size());
                    List<Map<String, Object>> batch = batchForAI.subList(i, endIdx);
                    
                    log.info("Processing batch {} of {} (transactions {}-{})", 
                        (i/batchSize + 1), 
                        (int) Math.ceil((double) batchForAI.size() / batchSize),
                        i + 1, endIdx);
                    
                    try {
                        Map<String, String> batchResults = aiCategorizationService.categorizeBatch(batch);
                        aiCategories.putAll(batchResults);
                        
                        // Small delay between batches to be nice to the API
                        if (i + batchSize < batchForAI.size()) {
                            Thread.sleep(1000);
                        }
                    } catch (Exception e) {
                        log.error("Batch processing failed, falling back to individual categorization", e);
                        // Fallback to individual processing for this batch
                        for (Map<String, Object> txnInfo : batch) {
                            String id = (String) txnInfo.get("id");
                            BigDecimal amount = (BigDecimal) txnInfo.get("amount");
                            String merchantName = (String) txnInfo.get("merchantName");
                            
                            try {
                                String category = aiCategorizationService.categorize(merchantName, amount);
                                aiCategories.put(id, category);
                            } catch (Exception ex) {
                                log.error("Individual categorization failed for {}, using fallback", id);
                                aiCategories.put(id, fallbackByAmount(amount));
                            }
                            
                            // Small delay between individual calls
                            try {
                                Thread.sleep(500);
                            } catch (InterruptedException ie) {
                                Thread.currentThread().interrupt();
                            }
                        }
                    }
                }
            }
            
            // Save all transactions
            int saved = 0;
            for (Map.Entry<String, Map> entry : rawTransactions.entrySet()) {
                String plaidTxnId = entry.getKey();
                Map txn = entry.getValue();
                
                String merchantName = (String) txn.get("merchant_name");
                BigDecimal bhdAmount = bhdAmounts.get(plaidTxnId);
                
                String finalMerchantName;
                String categoryName;
                
                // ===== FIX: NEVER use Plaid description =====
                if (merchantName == null || merchantName.trim().isEmpty()) {
                    // NULL merchant - use amount-based category + generated merchant name
                    categoryName = fallbackByAmount(bhdAmount);
                    finalMerchantName = aiCategorizationService.generateMerchantName(
                        categoryName, bhdAmount, null
                    );
                    log.info("✨ Generated merchant name: '{}' for null merchant (amount: {}, category: {})", 
                        finalMerchantName, bhdAmount, categoryName);
                } else {
                    // Has merchant name - use AI category
                    categoryName = aiCategories.getOrDefault(plaidTxnId, fallbackByAmount(bhdAmount));
                    finalMerchantName = merchantName;
                    log.info("✅ Using real merchant name: '{}' (category: {})", finalMerchantName, categoryName);
                }

                String type = bhdAmount.compareTo(BigDecimal.ZERO) >= 0 ? "DEBIT" : "CREDIT";
                LocalDate txnDate = LocalDate.parse((String) txn.get("date"));
                
                TransactionCategory category = getOrCreateCategory(categoryName);

                transactionRepository.save(Transaction.builder()
                        .account(account)
                        .category(category)
                        .plaidTransactionId(plaidTxnId)
                        .merchantName(finalMerchantName)  // Real name OR generated name
                        .amount(bhdAmount.abs())
                        .type(com.pathwise.backend.enums.TransactionType.valueOf(type))
                        .currency("BHD")
                        .transactionDate(txnDate)
                        .aiCategoryRaw(categoryName)
                        .createdAt(LocalDateTime.now())
                        .build());
                saved++;
            }
            
            log.info("✅ Saved {} transactions for account {}", saved, account.getId());
            
        } catch (Exception e) {
            log.error("Failed to fetch transactions: {}", e.getMessage());
            throw new RuntimeException("Failed to fetch transactions: " + e.getMessage());
        }
    }

    private String fallbackByAmount(BigDecimal amount) {
        if (amount.compareTo(new BigDecimal("500")) > 0) return "SHOPPING";
        if (amount.compareTo(new BigDecimal("100")) > 0) return "FOOD & DINING";
        if (amount.compareTo(new BigDecimal("50")) > 0) return "TRANSPORT";
        if (amount.compareTo(new BigDecimal("20")) > 0) return "ENTERTAINMENT";
        return "OTHER";
    }

    private TransactionCategory getOrCreateCategory(String name) {
        return categoryRepository.findByName(name)
                .orElseGet(() -> categoryRepository.save(TransactionCategory.builder()
                        .name(name)
                        .icon(getCategoryIcon(name))
                        .colorHex(getCategoryColor(name))
                        .build()));
    }

    private BigDecimal extractAmount(Object obj) {
        if (obj == null) return BigDecimal.ZERO;
        if (obj instanceof Number n) return BigDecimal.valueOf(n.doubleValue());
        return new BigDecimal(obj.toString());
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
            case "EDUCATION" -> "#74B9FF";
            case "TRAVEL" -> "#A29BFE";
            default -> "#95A5A6";
        };
    }

    private User getCurrentUser() {
        UserDetails userDetails = (UserDetails) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        return userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new UserNotFoundException("User not found"));
    }
}