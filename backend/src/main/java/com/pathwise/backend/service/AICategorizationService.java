package com.pathwise.backend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class AICategorizationService {

    private final RestTemplate restTemplate;

    @Value("${groq.api-key}")
    private String groqApiKey;

    @Value("${groq.url}")
    private String groqUrl;

    @Value("${groq.model}")
    private String groqModel;

    private static final List<String> VALID_CATEGORIES = List.of(
            "FOOD & DINING", "TRANSPORT", "SHOPPING", "ENTERTAINMENT",
            "HEALTH", "UTILITIES", "EDUCATION", "TRAVEL", "OTHER"
    );

    public String categorize(String merchantName, BigDecimal amount) {
        log.info("========== AI CATEGORIZATION CALLED ==========");
        log.info("Merchant: '{}'", merchantName);
        log.info("Amount: {}", amount);
        log.info("Groq API Key present: {}", groqApiKey != null ? "YES (length: " + groqApiKey.length() + ")" : "NO");
        log.info("Groq URL: {}", groqUrl);
        log.info("Groq Model: {}", groqModel);
        
        // Handle null merchant names - use amount-based fallback
        if (merchantName == null || merchantName.trim().isEmpty()) {
            log.info("Merchant is null/empty, using amount-based fallback");
            String fallback = fallbackByAmount(amount);
            log.info("Amount-based fallback returned: {}", fallback);
            return fallback;
        }
        
        // ALL merchants with names go to Groq AI (no rules!)
        log.info("📡 Calling Groq API for merchant: '{}'", merchantName);
        
        try {
            String aiCategory = callGroqForCategory(merchantName, amount);
            log.info("✅ GROQ RETURNED: {} -> {}", merchantName, aiCategory);
            return aiCategory;
        } catch (Exception e) {
            log.error("❌ GROQ API CALL FAILED for '{}'", merchantName);
            log.error("Error message: {}", e.getMessage());
            log.error("Exception type: {}", e.getClass().getName());
            log.error("Stack trace: ", e);
            
            String fallback = fallbackByAmount(amount);
            log.info("Using amount-based fallback: {}", fallback);
            return fallback;
        }
    }

    /**
     * Categorize multiple transactions in one batch call
     */
    public Map<String, String> categorizeBatch(List<Map<String, Object>> transactions) {
        if (transactions == null || transactions.isEmpty()) {
            return Collections.emptyMap();
        }
        
        log.info("========== BATCH AI CATEGORIZATION CALLED ==========");
        log.info("Processing {} transactions in one batch", transactions.size());
        log.info("Groq API Key present: {}", groqApiKey != null ? "YES (length: " + groqApiKey.length() + ")" : "NO");
        
        try {
            return callGroqForBatch(transactions);
        } catch (Exception e) {
            log.error("❌ Batch Groq API call failed: {}", e.getMessage());
            log.error("Exception type: {}", e.getClass().getName());
            log.error("Stack trace: ", e);
            
            // Fallback to individual amount-based categorization
            Map<String, String> fallbackResults = new HashMap<>();
            for (Map<String, Object> txn : transactions) {
                String id = (String) txn.get("id");
                BigDecimal amount = (BigDecimal) txn.get("amount");
                fallbackResults.put(id, fallbackByAmount(amount));
            }
            log.info("Using amount-based fallback for {} transactions", transactions.size());
            return fallbackResults;
        }
    }

    /**
     * Generate a merchant name based on category (ONE specific merchant per category)
     * NEVER uses Plaid descriptions
     */
    public String generateMerchantName(String category, BigDecimal amount, String description) {
        // We completely ignore description - never use it
        
        return switch (category) {
            case "SHOPPING" -> "Amazon";
            case "FOOD & DINING" -> "Restaurant";
            case "TRANSPORT" -> "Uber";
            case "ENTERTAINMENT" -> "Netflix";
            case "HEALTH" -> "Pharmacy";
            case "UTILITIES" -> "Utility Bill";
            case "EDUCATION" -> "School";
            case "TRAVEL" -> "Airline";
            case "OTHER" -> "Bank Transaction";
            default -> "Bank Transaction";
        };
    }

    /**
     * Fallback categorization based on amount
     */
    private String fallbackByAmount(BigDecimal amount) {
        if (amount.compareTo(new BigDecimal("500")) > 0) return "SHOPPING";
        if (amount.compareTo(new BigDecimal("100")) > 0) return "FOOD & DINING";
        if (amount.compareTo(new BigDecimal("50")) > 0) return "TRANSPORT";
        if (amount.compareTo(new BigDecimal("20")) > 0) return "ENTERTAINMENT";
        return "OTHER";
    }

    /**
     * Call Groq API for single transaction
     */
    private String callGroqForCategory(String merchantName, BigDecimal amount) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(groqApiKey);

        String prompt = "Categorize this bank transaction into exactly ONE of these categories: " +
                "FOOD & DINING, TRANSPORT, SHOPPING, ENTERTAINMENT, HEALTH, UTILITIES, EDUCATION, TRAVEL, OTHER\n\n" +
                "Transaction: " + merchantName + " - Amount: " + amount + " BHD\n\n" +
                "Reply with ONLY the category name, nothing else.";

        Map<String, Object> requestBody = Map.of(
                "model", groqModel,
                "messages", List.of(Map.of("role", "user", "content", prompt)),
                "max_tokens", 20,
                "temperature", 0.1
        );

        try {
            log.info("📤 Sending request to Groq for: '{}'", merchantName);
            log.debug("Request body: {}", requestBody);
            
            long startTime = System.currentTimeMillis();
            Map response = restTemplate.postForObject(
                    groqUrl,
                    new HttpEntity<>(requestBody, headers),
                    Map.class);
            long endTime = System.currentTimeMillis();
            
            log.info("📥 Groq response received in {}ms", (endTime - startTime));
            log.debug("Full Groq response: {}", response);

            if (response == null) {
                log.error("Groq returned null response");
                return "OTHER";
            }

            List choices = (List) response.get("choices");
            if (choices == null || choices.isEmpty()) {
                log.error("No choices in Groq response");
                return "OTHER";
            }
            
            Map firstChoice = (Map) choices.get(0);
            Map msg = (Map) firstChoice.get("message");
            if (msg == null || msg.get("content") == null) {
                log.error("No message content in Groq response");
                return "OTHER";
            }
            
            String category = ((String) msg.get("content")).trim().toUpperCase();
            log.info("Groq raw response: '{}'", category);
            
            // Clean up any extra text
            if (category.contains("\n")) {
                category = category.split("\n")[0].trim();
            }
            if (category.contains(".")) {
                category = category.split("\\.")[0].trim();
            }
            
            log.info("Groq cleaned category: '{}'", category);
            
            boolean isValid = VALID_CATEGORIES.contains(category);
            log.info("Category valid: {}", isValid);
            
            return isValid ? category : "OTHER";
            
        } catch (Exception e) {
            log.error("❌ Groq API call failed: {}", e.getMessage());
            log.error("Exception type: {}", e.getClass().getName());
            if (e.getMessage() != null && e.getMessage().contains("403")) {
                log.error("API key might be invalid or expired");
            }
            if (e.getMessage() != null && e.getMessage().contains("429")) {
                log.error("Rate limit exceeded");
            }
            throw e;
        }
    }

    /**
     * Call Groq API for batch transactions
     */
    private Map<String, String> callGroqForBatch(List<Map<String, Object>> transactions) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(groqApiKey);

        StringBuilder promptBuilder = new StringBuilder();
        promptBuilder.append("Categorize these bank transactions into exactly ONE category each from: ");
        promptBuilder.append("FOOD & DINING, TRANSPORT, SHOPPING, ENTERTAINMENT, HEALTH, UTILITIES, EDUCATION, TRAVEL, OTHER\n\n");
        
        for (int i = 0; i < transactions.size(); i++) {
            Map<String, Object> txn = transactions.get(i);
            String merchantName = (String) txn.get("merchantName");
            BigDecimal amount = (BigDecimal) txn.get("amount");
            promptBuilder.append(String.format("%d. Transaction: %s - Amount: %s BHD\n", 
                i + 1, merchantName != null ? merchantName : "Unknown", amount));
        }
        
        promptBuilder.append("\nReply with ONLY the category numbers and names, one per line, like:\n");
        promptBuilder.append("1: FOOD & DINING\n2: TRANSPORT\netc.");

        Map<String, Object> requestBody = Map.of(
                "model", groqModel,
                "messages", List.of(Map.of("role", "user", "content", promptBuilder.toString())),
                "max_tokens", 50 * transactions.size(),
                "temperature", 0.1
        );

        int maxRetries = 3;
        int retryDelay = 2000;
        
        for (int attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                log.info("📤 Sending batch request to Groq for {} transactions (attempt {}/{})", 
                        transactions.size(), attempt, maxRetries);
                
                long startTime = System.currentTimeMillis();
                Map response = restTemplate.postForObject(
                        groqUrl,
                        new HttpEntity<>(requestBody, headers),
                        Map.class);
                long endTime = System.currentTimeMillis();
                
                log.info("📥 Batch Groq response received in {}ms", (endTime - startTime));
                log.info("Batch response content: {}", response.get("choices"));

                if (response == null) {
                    throw new RuntimeException("Null response from Groq");
                }

                List choices = (List) response.get("choices");
                if (choices == null || choices.isEmpty()) {
                    throw new RuntimeException("No choices in response");
                }

                Map firstChoice = (Map) choices.get(0);
                Map msg = (Map) firstChoice.get("message");
                String content = (String) msg.get("content");
                
                log.info("Batch response content: {}", content);
                
                Map<String, String> results = new HashMap<>();
                String[] lines = content.split("\n");
                
                for (int i = 0; i < Math.min(lines.length, transactions.size()); i++) {
                    String line = lines[i].trim();
                    if (line.contains(":")) {
                        String category = line.substring(line.indexOf(":") + 1).trim().toUpperCase();
                        if (category.contains("\n")) {
                            category = category.split("\n")[0].trim();
                        }
                        if (category.contains(".")) {
                            category = category.split("\\.")[0].trim();
                        }
                        
                        if (VALID_CATEGORIES.contains(category)) {
                            String txnId = (String) transactions.get(i).get("id");
                            results.put(txnId, category);
                            log.info("Batch categorized {} -> {}", transactions.get(i).get("merchantName"), category);
                        }
                    }
                }
                
                // Fill in any missing with fallback
                for (Map<String, Object> txn : transactions) {
                    String id = (String) txn.get("id");
                    if (!results.containsKey(id)) {
                        BigDecimal amount = (BigDecimal) txn.get("amount");
                        String fallback = fallbackByAmount(amount);
                        results.put(id, fallback);
                        log.info("Using fallback for transaction {}: {}", id, fallback);
                    }
                }
                
                return results;
                
            } catch (Exception e) {
                log.error("❌ Batch Groq API call failed on attempt {}: {}", attempt, e.getMessage());
                
                if (e.getMessage() != null && e.getMessage().contains("429") && attempt < maxRetries) {
                    log.warn("Rate limit hit, retrying in {} seconds...", retryDelay / 1000);
                    try {
                        Thread.sleep(retryDelay);
                        retryDelay *= 2;
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        break;
                    }
                } else {
                    throw e;
                }
            }
        }
        
        throw new RuntimeException("Failed to get batch categorization after " + maxRetries + " attempts");
    }
}