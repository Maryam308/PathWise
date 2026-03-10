package com.pathwise.backend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.util.*;

/**
 * Service responsible for AI-powered categorization of financial transactions.
 * Uses Groq API to categorize transactions based on merchant names and amounts.
 * Provides both single and batch categorization capabilities with fallback mechanisms.
 * 
 * @author PathWise Team
 * @version 1.0
 */
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

    /**
     * List of valid transaction categories that can be assigned by the AI.
     * All categories are uppercase for consistency in processing.
     */
    private static final List<String> VALID_CATEGORIES = List.of(
            "FOOD & DINING", "TRANSPORT", "SHOPPING", "ENTERTAINMENT",
            "HEALTH", "UTILITIES", "EDUCATION", "TRAVEL", "OTHER"
    );

    /**
     * Categorizes a single transaction based on merchant name and amount.
     * All non-null merchant names are processed through Groq API, with fallback
     * categorization based on transaction amount if Groq API call fails or merchant name is null.
     *
     * @param merchantName The name of the merchant for the transaction
     * @param amount The transaction amount
     * @return The assigned category from VALID_CATEGORIES
     */
    public String categorize(String merchantName, BigDecimal amount) {
        // Handle null merchant names - use amount-based fallback
        if (merchantName == null || merchantName.trim().isEmpty()) {
            return fallbackByAmount(amount);
        }
        
        try {
            return callGroqForCategory(merchantName, amount);
        } catch (Exception e) {
            return fallbackByAmount(amount);
        }
    }

    /**
     * Categorizes multiple transactions in a single batch API call to Groq.
     * Optimizes API usage by grouping multiple categorization requests together.
     * Falls back to amount-based categorization for any failed or missing categorizations.
     *
     * @param transactions List of transaction maps containing id, merchantName, and amount
     * @return Map of transaction IDs to their assigned categories
     */
    public Map<String, String> categorizeBatch(List<Map<String, Object>> transactions) {
        if (transactions == null || transactions.isEmpty()) {
            return Collections.emptyMap();
        }
        
        try {
            return callGroqForBatch(transactions);
        } catch (Exception e) {
            // Fallback to individual amount-based categorization
            Map<String, String> fallbackResults = new HashMap<>();
            for (Map<String, Object> txn : transactions) {
                String id = (String) txn.get("id");
                BigDecimal amount = (BigDecimal) txn.get("amount");
                fallbackResults.put(id, fallbackByAmount(amount));
            }
            return fallbackResults;
        }
    }

    /**
     * Generates a merchant name based on the transaction category.
     * Maps each category to a specific, representative merchant name.
     * Note: This method intentionally ignores the provided description parameter.
     *
     * @param category The transaction category
     * @param amount The transaction amount (unused but kept for interface consistency)
     * @param description Original transaction description (explicitly ignored)
     * @return A representative merchant name for the category
     */
    public String generateMerchantName(String category, BigDecimal amount, String description) {
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
     * Provides fallback categorization based solely on transaction amount.
     * Uses predefined amount thresholds to assign appropriate categories.
     *
     * @param amount The transaction amount in BHD
     * @return The assigned category based on amount thresholds
     */
    private String fallbackByAmount(BigDecimal amount) {
        if (amount.compareTo(new BigDecimal("500")) > 0) return "SHOPPING";
        if (amount.compareTo(new BigDecimal("100")) > 0) return "FOOD & DINING";
        if (amount.compareTo(new BigDecimal("50")) > 0) return "TRANSPORT";
        if (amount.compareTo(new BigDecimal("20")) > 0) return "ENTERTAINMENT";
        return "OTHER";
    }

    /**
     * Makes an API call to Groq for single transaction categorization.
     * Constructs a prompt with the transaction details and parses the response.
     *
     * @param merchantName The merchant name to categorize
     * @param amount The transaction amount
     * @return The category returned by Groq, or "OTHER" if invalid/parsing fails
     * @throws RuntimeException if the API call fails
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
            Map response = restTemplate.postForObject(
                    groqUrl,
                    new HttpEntity<>(requestBody, headers),
                    Map.class);

            if (response == null) {
                return "OTHER";
            }

            List choices = (List) response.get("choices");
            if (choices == null || choices.isEmpty()) {
                return "OTHER";
            }
            
            Map firstChoice = (Map) choices.get(0);
            Map msg = (Map) firstChoice.get("message");
            if (msg == null || msg.get("content") == null) {
                return "OTHER";
            }
            
            String category = ((String) msg.get("content")).trim().toUpperCase();
            
            // Clean up any extra text from the response
            if (category.contains("\n")) {
                category = category.split("\n")[0].trim();
            }
            if (category.contains(".")) {
                category = category.split("\\.")[0].trim();
            }
            
            return VALID_CATEGORIES.contains(category) ? category : "OTHER";
            
        } catch (Exception e) {
            throw new RuntimeException("Groq API call failed: " + e.getMessage(), e);
        }
    }

    /**
     * Makes a batch API call to Groq for multiple transaction categorizations.
     * Implements retry logic with exponential backoff for handling rate limits.
     *
     * @param transactions List of transaction maps to categorize
     * @return Map of transaction IDs to their assigned categories
     * @throws RuntimeException if all retry attempts fail
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
                Map response = restTemplate.postForObject(
                        groqUrl,
                        new HttpEntity<>(requestBody, headers),
                        Map.class);

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
                        }
                    }
                }
                
                // Fill in any missing categorizations with amount-based fallback
                for (Map<String, Object> txn : transactions) {
                    String id = (String) txn.get("id");
                    if (!results.containsKey(id)) {
                        BigDecimal amount = (BigDecimal) txn.get("amount");
                        String fallback = fallbackByAmount(amount);
                        results.put(id, fallback);
                    }
                }
                
                return results;
                
            } catch (Exception e) {
                // Implement retry logic with exponential backoff for rate limiting
                if (e.getMessage() != null && e.getMessage().contains("429") && attempt < maxRetries) {
                    try {
                        Thread.sleep(retryDelay);
                        retryDelay *= 2;
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        throw new RuntimeException("Batch categorization interrupted", ie);
                    }
                } else {
                    throw new RuntimeException("Batch Groq API call failed after " + attempt + " attempts", e);
                }
            }
        }
        
        throw new RuntimeException("Failed to get batch categorization after " + maxRetries + " attempts");
    }
}