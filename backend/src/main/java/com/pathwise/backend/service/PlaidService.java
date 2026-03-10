package com.pathwise.backend.service;

import com.pathwise.backend.dto.LinkCardRequest;
import com.pathwise.backend.exception.UserNotFoundException;
import com.pathwise.backend.model.*;
import com.pathwise.backend.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Service responsible for integrating with Plaid API to handle banking operations.
 * Manages institution data, account linking, transaction syncing, and balance updates.
 * 
 * @author PathWise Team
 * @version 1.0
 */
@Slf4j
@Service
@RequiredArgsConstructor
@SuppressWarnings("unchecked")
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

    /**
     * Inner class representing a Plaid institution with its capabilities.
     */
    private static class PlaidInstitution {
        private final String id;
        private final String name;
        private final List<String> products;
        private final List<String> countryCodes;

        public PlaidInstitution(String id, String name, List<String> products, List<String> countryCodes) {
            this.id = id;
            this.name = name;
            this.products = products != null ? products : List.of();
            this.countryCodes = countryCodes != null ? countryCodes : List.of();
        }

        public String getId() { return id; }
        public String getName() { return name; }
        public List<String> getProducts() { return products; }
        public List<String> getCountryCodes() { return countryCodes; }
    }

    // Cache for institution data to minimize API calls
    private List<PlaidInstitution> supportedInstitutions = new ArrayList<>();
    private Instant lastFetchTime = null;
    private static final Duration CACHE_DURATION = Duration.ofHours(24);
    
    // USD to BHD conversion rate (1 USD = 0.376 BHD)
    private static final BigDecimal USD_TO_BHD = new BigDecimal("0.376");
    
    // Fallback institutions when Plaid API is unavailable
    private static final List<String> FALLBACK_INSTITUTIONS = Arrays.asList(
        "ins_39",  // Chase
        "ins_56",  // Wells Fargo
        "ins_3",   // Bank of America
        "ins_109512" // Capital One
    );

    // ── INSTITUTION MANAGEMENT ──

    /**
     * Retrieves supported institutions, either from cache or by refreshing.
     *
     * @return List of supported Plaid institutions
     */
    private List<PlaidInstitution> getSupportedInstitutions() {
        if (!supportedInstitutions.isEmpty() && lastFetchTime != null && 
            Duration.between(lastFetchTime, Instant.now()).compareTo(CACHE_DURATION) < 0) {
            log.debug("Returning {} cached institutions", supportedInstitutions.size());
            return supportedInstitutions;
        }
        return refreshInstitutionsCache();
    }

    /**
     * Fetches the latest list of supported institutions from Plaid API.
     *
     * @return Updated list of supported institutions
     */
    private List<PlaidInstitution> refreshInstitutionsCache() {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("client_id", clientId);
            requestBody.put("secret", plaidSecret);
            requestBody.put("count", 500);
            requestBody.put("offset", 0);
            requestBody.put("country_codes", List.of("US"));

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestBody, headers);

            Map<String, Object> response = restTemplate.postForObject(
                getPlaidBaseUrl() + "/institutions/get",
                request,
                Map.class
            );

            if (response == null || !response.containsKey("institutions")) {
                throw new RuntimeException("Invalid response from Plaid");
            }

            List<Map<String, Object>> institutions = (List<Map<String, Object>>) response.get("institutions");
            
            supportedInstitutions = institutions.stream()
                .map(this::mapToPlaidInstitution)
                .filter(inst -> inst.getProducts().contains("transactions"))
                .collect(Collectors.toList());

            lastFetchTime = Instant.now();

        } catch (Exception e) {
            log.error("Failed to fetch institutions: {}", e.getMessage());
            supportedInstitutions = createFallbackInstitutions();
            lastFetchTime = Instant.now();
        }

        return supportedInstitutions;
    }

    /**
     * Creates a fallback list of institutions when Plaid API is unavailable.
     *
     * @return Hardcoded list of common institutions
     */
    private List<PlaidInstitution> createFallbackInstitutions() {
        log.warn("Creating fallback institutions list");
        
        Map<String, String> fallbackMap = Map.of(
            "ins_39", "Chase",
            "ins_56", "Wells Fargo",
            "ins_3", "Bank of America",
            "ins_109512", "Capital One"
        );

        return fallbackMap.entrySet().stream()
            .map(entry -> new PlaidInstitution(
                entry.getKey(),
                entry.getValue(),
                List.of("transactions"),
                List.of("US")
            ))
            .collect(Collectors.toList());
    }

    /**
     * Maps raw API response data to a PlaidInstitution object.
     *
     * @param data Raw institution data from Plaid
     * @return Structured PlaidInstitution object
     */
    private PlaidInstitution mapToPlaidInstitution(Map<String, Object> data) {
        String id = (String) data.get("institution_id");
        String name = (String) data.get("name");
        
        List<String> products = new ArrayList<>();
        if (data.containsKey("products")) {
            products = ((List<Map<String, String>>) data.get("products")).stream()
                .map(p -> p.get("type"))
                .collect(Collectors.toList());
        }

        List<String> countryCodes = (List<String>) data.getOrDefault("country_codes", List.of());

        return new PlaidInstitution(id, name, products, countryCodes);
    }

    /**
     * Selects a random institution from the supported list.
     *
     * @return Randomly selected PlaidInstitution
     */
    private PlaidInstitution getRandomInstitution() {
        List<PlaidInstitution> institutions = getSupportedInstitutions();
        
        if (institutions.isEmpty()) {
            institutions = createFallbackInstitutions();
        }
        
        List<PlaidInstitution> validInstitutions = institutions.stream()
            .filter(inst -> inst.getProducts().contains("transactions"))
            .collect(Collectors.toList());
        
        if (validInstitutions.isEmpty()) {
            validInstitutions = institutions;
        }

        PlaidInstitution selected = validInstitutions.get(
            new Random().nextInt(validInstitutions.size())
        );
        
        return selected;
    }

    /**
     * Retrieves an institution by its ID.
     *
     * @param institutionId The Plaid institution ID
     * @return Optional containing the institution if found
     */
    private Optional<PlaidInstitution> getInstitutionById(String institutionId) {
        return getSupportedInstitutions().stream()
            .filter(inst -> inst.getId().equals(institutionId))
            .findFirst();
    }

    /**
     * Constructs the Plaid API base URL based on environment.
     *
     * @return Plaid API endpoint URL
     */
    private String getPlaidBaseUrl() {
        return switch (plaidEnv) {
            case "production" -> "https://production.plaid.com";
            case "development" -> "https://development.plaid.com";
            default -> "https://sandbox.plaid.com";
        };
    }

    /**
     * Retrieves the current authenticated user's ID.
     *
     * @return User UUID
     */
    private UUID getCurrentUserId() {
        UserDetails userDetails = (UserDetails) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        return userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new UserNotFoundException("User not found"))
                .getId();
    }

    /**
     * Retrieves the current authenticated user entity.
     *
     * @return User entity
     */
    private User getCurrentUser() {
        UserDetails userDetails = (UserDetails) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        return userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new UserNotFoundException("User not found"));
    }

    /**
     * Fetches all accounts belonging to the current user.
     *
     * @return List of user accounts (max 1)
     */
    public List<Account> getCurrentUserAccounts() {
        User user = getCurrentUser();
        return accountRepository.findByUserId(user.getId())
                .map(List::of)
                .orElse(List.of());
    }

    // ── ADD MONTHLY SALARY ──
    
    /**
     * Scheduled task that adds monthly salary to all accounts on the 1st of each month.
     * Runs at midnight Bahrain time.
     */
    @Transactional
    @Scheduled(cron = "0 0 0 1 * ?", zone = "Asia/Bahrain")
    public void addMonthlySalaryToAllAccounts() {
        List<Account> allAccounts = accountRepository.findAll();
        LocalDate now = LocalDate.now();
        
        for (Account account : allAccounts) {
            try {
                // Check if salary already added this month
                if (account.getLastSalaryUpdate() != null && 
                    account.getLastSalaryUpdate().getMonth() == now.getMonth() &&
                    account.getLastSalaryUpdate().getYear() == now.getYear()) {
                    continue;
                }
                
                User user = account.getUser();
                BigDecimal monthlySalary = user.getMonthlySalary() != null ? user.getMonthlySalary() : BigDecimal.ZERO;
                
                if (monthlySalary.compareTo(BigDecimal.ZERO) > 0) {
                    BigDecimal currentBalance = account.getBalance();
                    account.setBalance(currentBalance.add(monthlySalary));
                    account.setLastSalaryUpdate(now);
                    accountRepository.save(account);
                    
                    log.info("Added monthly salary {} to account {}. New balance: {}", 
                        monthlySalary, account.getId(), account.getBalance());
                }
            } catch (Exception e) {
                log.error("Failed to add salary to account {}: {}", account.getId(), e.getMessage());
            }
        }
    }

    // ── FULL PLAID FLOW METHODS ──

    /**
     * Creates a link token for Plaid Link initialization.
     *
     * @return Plaid link token
     */
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
            Map<String, Object> response = restTemplate.postForObject(
                    getPlaidBaseUrl() + "/link/token/create",
                    request, Map.class);
            return (String) response.get("link_token");
        } catch (Exception e) {
            log.error("Failed to create link token: {}", e.getMessage());
            throw new RuntimeException("Failed to create Plaid link token");
        }
    }

    /**
     * Exchanges a public token for an access token and saves the account.
     *
     * @param publicToken Plaid public token
     * @param bankId Bahrain bank ID
     * @param institutionName Name of the institution
     */
    @Transactional
    public void exchangeTokenAndSave(String publicToken, String bankId, String institutionName) {
        User user = getCurrentUser();

        if (accountRepository.findByUserId(user.getId()).isPresent()) {
            throw new IllegalStateException("Account already linked");
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> body = Map.of(
                "client_id", clientId,
                "secret", plaidSecret,
                "public_token", publicToken
        );

        Map<String, Object> response = restTemplate.postForObject(
                getPlaidBaseUrl() + "/item/public_token/exchange",
                new HttpEntity<>(body, headers), Map.class);

        String accessToken = (String) response.get("access_token");

        Map<String, Object> accountsBody = Map.of(
                "client_id", clientId,
                "secret", plaidSecret,
                "access_token", accessToken
        );

        Map<String, Object> accountsResponse = restTemplate.postForObject(
                getPlaidBaseUrl() + "/accounts/get",
                new HttpEntity<>(accountsBody, headers), Map.class);

        List<Map<String, Object>> accounts = (List<Map<String, Object>>) accountsResponse.get("accounts");
        if (accounts.isEmpty()) {
            throw new RuntimeException("No accounts found");
        }
        
        Map<String, Object> plaidAccount = accounts.get(0);
        Map<String, Object> balances = (Map<String, Object>) plaidAccount.get("balances");
        BigDecimal plaidBalance = extractAmount(balances.get("current"));

        com.pathwise.backend.enums.BahrainBank bank = 
                com.pathwise.backend.enums.BahrainBank.valueOf(bankId);

        // Get monthly salary
        BigDecimal monthlySalary = user.getMonthlySalary() != null ? user.getMonthlySalary() : BigDecimal.ZERO;
        
        // Initial balance = Plaid balance + first month's salary
        BigDecimal initialBalance = plaidBalance.add(monthlySalary);

        Account account = Account.builder()
                .user(user)
                .plaidAccountId((String) plaidAccount.get("account_id"))
                .plaidAccessToken(accessToken)
                .bank(bank)
                .bankName(bank.getDisplayName())
                .accountType((String) plaidAccount.get("type"))
                .initialPlaidBalance(plaidBalance)
                .balance(initialBalance)
                .currency("BHD")
                .lastSalaryUpdate(LocalDate.now())
                .totalExpensesToDate(BigDecimal.ZERO)
                .createdAt(LocalDateTime.now())
                .build();

        accountRepository.save(account);
        log.info("Account saved for user {} with bank: {}", user.getId(), bank.getDisplayName());

        fetchAndStoreTransactions(accessToken, account);
    }

    /**
     * Links a card manually without using Plaid Link.
     *
     * @param request Card linking request containing card details
     */
    @Transactional
    public void linkCard(LinkCardRequest request) {
        User user = getCurrentUser();

        if (accountRepository.findByUserId(user.getId()).isPresent()) {
            throw new IllegalStateException("Account already linked");
        }

        PlaidInstitution randomInstitution = getRandomInstitution();
        
        String publicToken = createSandboxPublicToken(randomInstitution.getId());
        String accessToken = exchangePublicToken(publicToken);

        Map<String, Object> plaidAccount = getPlaidAccount(accessToken);
        Map<String, Object> balances = (Map<String, Object>) plaidAccount.get("balances");
        BigDecimal plaidBalance = extractAmount(balances.get("current"));
        
        // Get monthly salary
        BigDecimal monthlySalary = user.getMonthlySalary() != null ? user.getMonthlySalary() : BigDecimal.ZERO;
        
        // Initial balance = Plaid balance + first month's salary
        BigDecimal initialBalance = plaidBalance.add(monthlySalary);

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
                .initialPlaidBalance(plaidBalance)
                .balance(initialBalance)
                .currency("BHD")
                .lastSalaryUpdate(LocalDate.now())
                .totalExpensesToDate(BigDecimal.ZERO)
                .createdAt(LocalDateTime.now())
                .build();

        accountRepository.save(account);
        log.info("Card linked for user {}: {} (using random Plaid institution: {} - {})", 
                user.getId(), request.getBank().getDisplayName(), 
                randomInstitution.getId(), randomInstitution.getName());

        try {
            Thread.sleep(5000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        fetchAndStoreTransactions(accessToken, account);
    }

    /**
     * Manually triggers transaction sync for the current user.
     */
    @Transactional
    public void syncTransactions() {
        User user = getCurrentUser();
        Account account = accountRepository.findByUserId(user.getId())
                .orElseThrow(() -> new IllegalStateException("No linked account found"));

        if (account.getPlaidAccessToken() == null) {
            throw new IllegalStateException("No Plaid access token");
        }
        fetchAndStoreTransactions(account.getPlaidAccessToken(), account);
    }

    /**
     * Creates a sandbox public token for testing.
     *
     * @param institutionId Plaid institution ID
     * @return Sandbox public token
     */
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
            Map<String, Object> response = restTemplate.postForObject(
                    getPlaidBaseUrl() + "/sandbox/public_token/create",
                    new HttpEntity<>(body, headers), Map.class);
            return (String) response.get("public_token");
        } catch (Exception e) {
            log.error("Failed to create sandbox token: {}", e.getMessage());
            throw new RuntimeException("Failed to connect to Plaid sandbox");
        }
    }

    /**
     * Exchanges a public token for an access token.
     *
     * @param publicToken Plaid public token
     * @return Plaid access token
     */
    private String exchangePublicToken(String publicToken) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> body = Map.of(
                "client_id", clientId,
                "secret", plaidSecret,
                "public_token", publicToken
        );

        Map<String, Object> response = restTemplate.postForObject(
                getPlaidBaseUrl() + "/item/public_token/exchange",
                new HttpEntity<>(body, headers), Map.class);
        return (String) response.get("access_token");
    }

    /**
     * Retrieves account details from Plaid using an access token.
     *
     * @param accessToken Plaid access token
     * @return Plaid account data
     */
    private Map<String, Object> getPlaidAccount(String accessToken) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> body = Map.of(
                "client_id", clientId,
                "secret", plaidSecret,
                "access_token", accessToken
        );

        Map<String, Object> response = restTemplate.postForObject(
                getPlaidBaseUrl() + "/accounts/get",
                new HttpEntity<>(body, headers), Map.class);

        List<Map<String, Object>> accounts = (List<Map<String, Object>>) response.get("accounts");
        if (accounts == null || accounts.isEmpty()) {
            throw new RuntimeException("No accounts found");
        }
        return accounts.get(0);
    }

    /**
     * Fetches and stores transactions from Plaid for a given account.
     * Updates account balance based on net transaction changes.
     *
     * @param accessToken Plaid access token
     * @param account Account entity to associate transactions with
     */
    @Transactional
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
            Map<String, Object> response = restTemplate.postForObject(
                    getPlaidBaseUrl() + "/transactions/get",
                    new HttpEntity<>(body, headers), Map.class);

            List<Map<String, Object>> transactions = (List<Map<String, Object>>) response.get("transactions");
            
            // Track net balance change from ALL transactions
            BigDecimal totalBalanceChange = BigDecimal.ZERO;
            LocalDate now = LocalDate.now();
            
            // Prepare transactions for batch processing
            List<Map<String, Object>> batchForAI = new ArrayList<>();
            Map<String, Map<String, Object>> rawTransactions = new HashMap<>();
            Map<String, BigDecimal> bhdAmounts = new HashMap<>();
            
            for (Map<String, Object> txn : transactions) {
                String plaidTxnId = (String) txn.get("transaction_id");
                
                // Skip if transaction already exists
                if (transactionRepository.existsByPlaidTransactionId(plaidTxnId)) {
                    continue;
                }

                String merchantName = (String) txn.get("merchant_name");
                
                // Convert amount from USD to BHD
                BigDecimal usdAmount = extractAmount(txn.get("amount"));
                BigDecimal bhdAmount = usdAmount.multiply(USD_TO_BHD).setScale(3, RoundingMode.HALF_UP);
                
                // Store data for later use
                bhdAmounts.put(plaidTxnId, bhdAmount);
                
                if (merchantName != null && !merchantName.trim().isEmpty()) {
                    Map<String, Object> txnInfo = new HashMap<>();
                    txnInfo.put("id", plaidTxnId);
                    txnInfo.put("merchantName", merchantName);
                    txnInfo.put("amount", bhdAmount);
                    batchForAI.add(txnInfo);
                }
                
                rawTransactions.put(plaidTxnId, txn);
            }
            
            if (rawTransactions.isEmpty()) {
                log.info("No new transactions to process");
                return;
            }
            
            Map<String, String> aiCategories = new HashMap<>();
            
            if (!batchForAI.isEmpty()) {
                int batchSize = 15;
                for (int i = 0; i < batchForAI.size(); i += batchSize) {
                    int endIdx = Math.min(i + batchSize, batchForAI.size());
                    List<Map<String, Object>> batch = batchForAI.subList(i, endIdx);
                    
                    try {
                        Map<String, String> batchResults = aiCategorizationService.categorizeBatch(batch);
                        aiCategories.putAll(batchResults);
                    } catch (Exception e) {
                        log.error("Batch processing failed, falling back to individual categorization", e);
                        for (Map<String, Object> txnInfo : batch) {
                            String id = (String) txnInfo.get("id");
                            BigDecimal amount = (BigDecimal) txnInfo.get("amount");
                            aiCategories.put(id, fallbackByAmount(amount));
                        }
                    }
                }
            }
            
            int saved = 0;
            for (Map.Entry<String, Map<String, Object>> entry : rawTransactions.entrySet()) {
                String plaidTxnId = entry.getKey();
                Map<String, Object> txn = entry.getValue();
                
                String merchantName = (String) txn.get("merchant_name");
                BigDecimal bhdAmount = bhdAmounts.get(plaidTxnId);
                
                String finalMerchantName;
                String categoryName;
                
                if (merchantName == null || merchantName.trim().isEmpty()) {
                    categoryName = fallbackByAmount(bhdAmount);
                    finalMerchantName = aiCategorizationService.generateMerchantName(
                        categoryName, bhdAmount, null
                    );
                } else {
                    categoryName = aiCategories.getOrDefault(plaidTxnId, fallbackByAmount(bhdAmount));
                    finalMerchantName = merchantName;
                }

                // Determine transaction type
                String transactionType = "DEBIT"; // Default to expense
                
                // Income indicators based on merchant name
                if (merchantName != null) {
                    String upperName = merchantName.toUpperCase();
                    if (upperName.contains("SALARY") || 
                        upperName.contains("PAYROLL") || 
                        upperName.contains("DEPOSIT") ||
                        upperName.contains("INTEREST") || 
                        upperName.contains("DIVIDEND") ||
                        upperName.contains("REFUND") || 
                        upperName.contains("REIMBURSEMENT") ||
                        upperName.contains("TRANSFER FROM") ||
                        upperName.contains("DIRECT DEPOSIT") ||
                        upperName.contains("PAYCHECK") ||
                        upperName.contains("BONUS") ||
                        upperName.contains("INCOME")) {
                        transactionType = "CREDIT";
                    }
                }

                // Check for negative amounts
                BigDecimal originalAmount = extractAmount(txn.get("amount"));
                if (originalAmount.compareTo(BigDecimal.ZERO) < 0) {
                    transactionType = "CREDIT";
                    bhdAmount = bhdAmount.abs();
                }

                LocalDate txnDate = LocalDate.parse((String) txn.get("date"));
                
                TransactionCategory category = getOrCreateCategory(categoryName);

                transactionRepository.save(Transaction.builder()
                        .account(account)
                        .category(category)
                        .plaidTransactionId(plaidTxnId)
                        .merchantName(finalMerchantName)
                        .amount(bhdAmount.abs())
                        .type(com.pathwise.backend.enums.TransactionType.valueOf(transactionType))
                        .currency("BHD")
                        .transactionDate(txnDate)
                        .aiCategoryRaw(categoryName)
                        .createdAt(LocalDateTime.now())
                        .build());
                
                // Track balance change for BOTH income and expenses
                if (transactionType.equals("DEBIT")) {
                    // Expense - subtract from balance
                    totalBalanceChange = totalBalanceChange.subtract(bhdAmount.abs());
                } else if (transactionType.equals("CREDIT")) {
                    // Income - add to balance
                    totalBalanceChange = totalBalanceChange.add(bhdAmount.abs());
                }
                
                saved++;
            }
            
            // Update account balance with net change from ALL transactions
            if (totalBalanceChange.compareTo(BigDecimal.ZERO) != 0) {
                BigDecimal currentBalance = account.getBalance();
                BigDecimal newBalance = currentBalance.add(totalBalanceChange);
                account.setBalance(newBalance);
                
                // Update total expenses to date
                if (totalBalanceChange.compareTo(BigDecimal.ZERO) < 0) {
                    BigDecimal expenseAmount = totalBalanceChange.abs();
                    BigDecimal currentTotalExpenses = account.getTotalExpensesToDate() != null ? 
                        account.getTotalExpensesToDate() : BigDecimal.ZERO;
                    account.setTotalExpensesToDate(currentTotalExpenses.add(expenseAmount));
                }
                
                accountRepository.save(account);
            }
            
            log.info("Saved {} transactions for account {}", saved, account.getId());
            
        } catch (Exception e) {
            log.error("Failed to fetch transactions: {}", e.getMessage());
            throw new RuntimeException("Failed to fetch transactions");
        }
    }

    /**
     * Determines a fallback category based on transaction amount.
     *
     * @param amount Transaction amount
     * @return Category name
     */
    private String fallbackByAmount(BigDecimal amount) {
        if (amount.compareTo(new BigDecimal("500")) > 0) return "SHOPPING";
        if (amount.compareTo(new BigDecimal("100")) > 0) return "FOOD & DINING";
        if (amount.compareTo(new BigDecimal("50")) > 0) return "TRANSPORT";
        if (amount.compareTo(new BigDecimal("20")) > 0) return "ENTERTAINMENT";
        return "OTHER";
    }

    /**
     * Retrieves or creates a transaction category by name.
     *
     * @param name Category name
     * @return TransactionCategory entity
     */
    private TransactionCategory getOrCreateCategory(String name) {
        return categoryRepository.findByName(name)
                .orElseGet(() -> categoryRepository.save(TransactionCategory.builder()
                        .name(name)
                        .icon(getCategoryIcon(name))
                        .colorHex(getCategoryColor(name))
                        .build()));
    }

    /**
     * Extracts a BigDecimal amount from various object types.
     *
     * @param obj Amount object from Plaid response
     * @return Extracted BigDecimal amount
     */
    private BigDecimal extractAmount(Object obj) {
        if (obj == null) return BigDecimal.ZERO;
        if (obj instanceof Number n) return BigDecimal.valueOf(n.doubleValue());
        return new BigDecimal(obj.toString());
    }

    /**
     * Returns an emoji icon for a category.
     *
     * @param category Category name
     * @return Emoji string
     */
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

    /**
     * Returns a color hex code for a category.
     *
     * @param category Category name
     * @return Color hex string
     */
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
}