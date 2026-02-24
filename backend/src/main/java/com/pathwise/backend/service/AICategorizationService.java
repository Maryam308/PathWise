package com.pathwise.backend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

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
        // Rules-based fallback first (fast, no API cost)
        String rulesCategory = applyRules(merchantName);
        if (rulesCategory != null) return rulesCategory;

        // AI categorization via Groq
        try {
            return callGroqForCategory(merchantName, amount);
        } catch (Exception e) {
            log.warn("AI categorization failed for {}, using OTHER: {}", merchantName, e.getMessage());
            return "OTHER";
        }
    }

    private String applyRules(String merchant) {
        if (merchant == null) return "OTHER";
        String lower = merchant.toLowerCase();

        if (lower.contains("mcdonald") || lower.contains("kfc") ||
                lower.contains("starbucks") || lower.contains("restaurant") ||
                lower.contains("cafe") || lower.contains("pizza") ||
                lower.contains("burger") || lower.contains("nandos"))
            return "FOOD & DINING";

        if (lower.contains("uber") || lower.contains("careem") ||
                lower.contains("taxi") || lower.contains("petrol") ||
                lower.contains("fuel") || lower.contains("parking"))
            return "TRANSPORT";

        if (lower.contains("amazon") || lower.contains("noon") ||
                lower.contains("ikea") || lower.contains("zara") ||
                lower.contains("h&m") || lower.contains("mall"))
            return "SHOPPING";

        if (lower.contains("netflix") || lower.contains("spotify") ||
                lower.contains("cinema") || lower.contains("game") ||
                lower.contains("playstation") || lower.contains("steam"))
            return "ENTERTAINMENT";

        if (lower.contains("pharmacy") || lower.contains("hospital") ||
                lower.contains("clinic") || lower.contains("doctor"))
            return "HEALTH";

        if (lower.contains("electric") || lower.contains("water") ||
                lower.contains("telecom") || lower.contains("internet") ||
                lower.contains("batelco") || lower.contains("zain"))
            return "UTILITIES";

        if (lower.contains("university") || lower.contains("school") ||
                lower.contains("course") || lower.contains("udemy"))
            return "EDUCATION";

        if (lower.contains("airline") || lower.contains("hotel") ||
                lower.contains("airbnb") || lower.contains("gulf air"))
            return "TRAVEL";

        return null; // Let AI decide
    }

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
                "max_tokens", 10,
                "temperature", 0.1
        );

        Map response = restTemplate.postForObject(
                groqUrl,
                new HttpEntity<>(requestBody, headers),
                Map.class);

        List choices = (List) response.get("choices");
        Map firstChoice = (Map) choices.get(0);
        Map msg = (Map) firstChoice.get("message");
        String category = ((String) msg.get("content")).trim().toUpperCase();

        return VALID_CATEGORIES.contains(category) ? category : "OTHER";
    }
}