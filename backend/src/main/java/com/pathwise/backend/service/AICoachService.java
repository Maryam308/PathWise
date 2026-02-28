package com.pathwise.backend.service;

import com.pathwise.backend.dto.ChatRequest;
import com.pathwise.backend.dto.ChatResponse;
import com.pathwise.backend.exception.AIServiceUnavailableException;
import com.pathwise.backend.exception.MessageTooLongException;
import com.pathwise.backend.exception.UserNotFoundException;
import com.pathwise.backend.model.AdviceHistory;
import com.pathwise.backend.model.Goal;
import com.pathwise.backend.model.MonthlyExpense;
import com.pathwise.backend.model.User;
import com.pathwise.backend.repository.AdviceHistoryRepository;
import com.pathwise.backend.repository.GoalRepository;
import com.pathwise.backend.repository.MonthlyExpenseRepository;
import com.pathwise.backend.repository.UserRepository;
import com.pathwise.backend.service.FinancialProfileService.FinancialSnapshot;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AICoachService {

    private final UserRepository           userRepository;
    private final GoalRepository           goalRepository;
    private final AdviceHistoryRepository  adviceHistoryRepository;
    private final MonthlyExpenseRepository expenseRepository;
    private final FinancialProfileService  financialProfileService;
    private final RestTemplate             restTemplate;

    @Value("${groq.api.key}")
    private String groqApiKey;

    private static final String GROQ_URL         = "https://api.groq.com/openai/v1/chat/completions";
    private static final String MODEL            = "llama-3.1-8b-instant";
    private static final int    MAX_TOKENS       = 300;
    private static final int    MAX_MESSAGE_LEN  = 2000;

    // ── Chat ──────────────────────────────────────────────────────────────────

    public ChatResponse chat(ChatRequest request) {
        if (request.getMessage() == null || request.getMessage().isBlank()) {
            throw new MessageTooLongException("Message cannot be empty.");
        }
        if (request.getMessage().length() > MAX_MESSAGE_LEN) {
            throw new MessageTooLongException(
                    "Message exceeds the maximum length of " + MAX_MESSAGE_LEN + " characters.");
        }

        User user = getCurrentUser();
        saveHistory(user, "user", request.getMessage());

        List<Map<String, String>> messages = new ArrayList<>();
        messages.add(Map.of("role", "system", "content", buildSystemPrompt(user)));
        messages.addAll(getRecentHistory(user));
        messages.add(Map.of("role", "user", "content", request.getMessage()));

        String reply = callGroq(messages);

        if (reply != null && !reply.isBlank()) {
            saveHistory(user, "assistant", reply);
        }

        return ChatResponse.builder()
                .message(reply)
                .role("assistant")
                .timestamp(LocalDateTime.now())
                .build();
    }

    // ── Weekly advice ─────────────────────────────────────────────────────────

    public ChatResponse getWeeklyAdvice() {
        User user = getCurrentUser();

        List<Map<String, String>> messages = List.of(
                Map.of("role", "system", "content", buildSystemPrompt(user)),
                Map.of("role", "user",   "content", buildCheckInPrompt(user))
        );

        String reply = callGroq(messages);

        if (reply != null && !reply.isBlank()) {
            saveHistory(user, "assistant", reply);
        }

        return ChatResponse.builder()
                .message(reply)
                .role("assistant")
                .timestamp(LocalDateTime.now())
                .build();
    }

    // ── System prompt ─────────────────────────────────────────────────────────

    private String buildSystemPrompt(User user) {
        List<Goal>           goals    = goalRepository.findByUserId(user.getId());
        List<MonthlyExpense> expenses = expenseRepository.findByUserId(user.getId());
        FinancialSnapshot    snap     = financialProfileService.getSnapshot(user);

        String firstName = (user.getFullName() != null && user.getFullName().contains(" "))
                ? user.getFullName().split(" ")[0]
                : user.getFullName();

        StringBuilder sb = new StringBuilder();

        sb.append("You are PathWise AI Coach — a friendly, specific, and practical personal finance ")
                .append("assistant for users in Bahrain. You give personalised advice based on the user's ")
                .append("real financial data below. Never give generic tips — always reference their actual ")
                .append("numbers and goals.\n\n");

        sb.append("USER: ").append(firstName)
                .append(" | Currency: ").append(user.getPreferredCurrency());
        if (user.getPhone() != null && !user.getPhone().isBlank())
            sb.append(" | Phone: ").append(user.getPhone());
        sb.append("\n\n");

        sb.append("FINANCIAL PROFILE:\n");
        sb.append("  Monthly salary:           BD ").append(snap.salary()).append("\n");
        sb.append("  Total fixed expenses:     BD ").append(snap.totalExpenses()).append("\n");
        sb.append("  Disposable income:        BD ").append(snap.disposableIncome())
                .append("  ← realistic savings ceiling\n");
        sb.append("  Total savings commitment: BD ").append(snap.totalMonthlySavings()).append("\n");
        if (snap.savingsRatePercent() != null)
            sb.append("  Savings rate:             ")
                    .append(String.format("%.1f%%", snap.savingsRatePercent()))
                    .append(" of disposable income\n");
        if (snap.warningLevel() != FinancialProfileService.WarningLevel.NONE)
            sb.append("  ⚠ ALERT (").append(snap.warningLevel()).append("): ")
                    .append(snap.warningMessage()).append("\n");

        if (!expenses.isEmpty()) {
            sb.append("\n  Fixed expense breakdown:\n");
            for (MonthlyExpense e : expenses) {
                sb.append("    ").append(e.getCategory()).append(": BD ").append(e.getAmount());
                if (e.getLabel() != null && !e.getLabel().isBlank())
                    sb.append(" (").append(e.getLabel()).append(")");
                sb.append("\n");
            }
        } else {
            sb.append("  (No fixed expenses declared — disposable income equals salary)\n");
        }

        sb.append("\nGOALS (").append(goals.size()).append("):\n");
        if (goals.isEmpty()) {
            sb.append("  None yet. Encourage the user to create their first goal.\n");
        } else {
            for (Goal g : goals) {
                BigDecimal saved = g.getSavedAmount() != null ? g.getSavedAmount() : BigDecimal.ZERO;
                BigDecimal rem   = g.getTargetAmount().subtract(saved);
                sb.append("  ▸ ").append(g.getName())
                        .append(" [").append(g.getStatus()).append("|").append(g.getPriority()).append("]\n");
                sb.append("    Target BD ").append(g.getTargetAmount())
                        .append(" | Saved BD ").append(saved)
                        .append(" | Remaining BD ").append(rem)
                        .append(" | Deadline ").append(g.getDeadline()).append("\n");
                if (g.getMonthlySavingsTarget() != null)
                    sb.append("    Monthly target: BD ").append(g.getMonthlySavingsTarget()).append("\n");
                else
                    sb.append("    Monthly target: not set — suggest the user set one\n");
            }
        }

        sb.append("\nBAHRAIN CONTEXT:\n");
        sb.append("  - Always use BD (Bahraini Dinar). Never use $ or other currencies.\n");
        sb.append("  - Common costs: Car BD 6k–25k, Apartment down-payment BD 15k–40k, ");
        sb.append("Japan trip BD 1.5k–3k, Emergency fund = 3–6 months of expenses.\n");
        sb.append("  - Local banks: BBK, Ahli United Bank, NBB, Bank of Bahrain and Kuwait.\n");
        sb.append("  - Recommended savings rate: 20–30% of disposable income.\n");

        sb.append("\nRULES:\n");
        sb.append("  - Always call the user ").append(firstName).append(".\n");
        sb.append("  - Reference their specific goals and amounts. Never give generic advice.\n");
        sb.append("  - If alert is RED, address it kindly but directly.\n");
        sb.append("  - If a goal has no monthly target, suggest setting one.\n");
        sb.append("  - Keep chat responses under 120 words. Be concise and actionable.\n");
        sb.append("  - You are a planning tool, not a licensed financial advisor.\n");

        return sb.toString();
    }

    private String buildCheckInPrompt(User user) {
        List<Goal>        goals = goalRepository.findByUserId(user.getId());
        FinancialSnapshot snap  = financialProfileService.getSnapshot(user);
        String firstName = user.getFullName().split(" ")[0];

        StringBuilder sb = new StringBuilder();
        sb.append("Give ").append(firstName).append(" a personalised weekly financial check-in. ");
        sb.append("Disposable income: BD ").append(snap.disposableIncome())
                .append(". Total monthly savings commitment: BD ")
                .append(snap.totalMonthlySavings()).append(". ");

        if (!goals.isEmpty()) {
            Goal urgent = goals.get(0);
            BigDecimal saved = urgent.getSavedAmount() != null
                    ? urgent.getSavedAmount() : BigDecimal.ZERO;
            sb.append("Most urgent goal: '").append(urgent.getName())
                    .append("' — BD ").append(saved)
                    .append(" saved of BD ").append(urgent.getTargetAmount())
                    .append(" by ").append(urgent.getDeadline()).append(". ");
        }

        sb.append("Give exactly 3 specific, numbered, actionable tips for this week. ")
                .append("Reference actual goals and BD amounts. Keep total under 150 words.");
        return sb.toString();
    }

    // ── Groq API ──────────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private String callGroq(List<Map<String, String>> messages) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(groqApiKey);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model",      MODEL);
        body.put("max_tokens", MAX_TOKENS);
        body.put("messages",   messages);

        try {
            ResponseEntity<Map> res = restTemplate.postForEntity(
                    GROQ_URL, new HttpEntity<>(body, headers), Map.class);

            if (res.getBody() == null) {
                throw new AIServiceUnavailableException(
                        "AI Coach returned an empty response. Please try again.");
            }

            List<Map<String, Object>> choices =
                    (List<Map<String, Object>>) res.getBody().get("choices");

            if (choices == null || choices.isEmpty()) {
                throw new AIServiceUnavailableException(
                        "AI Coach returned no choices. Please try again.");
            }

            Map<String, Object> msg = (Map<String, Object>) choices.get(0).get("message");
            return (String) msg.get("content");

        } catch (AIServiceUnavailableException e) {
            throw e; // already the right type — rethrow directly
        } catch (RestClientException e) {
            log.error("Groq API network error: {}", e.getMessage(), e);
            throw new AIServiceUnavailableException(
                    "AI Coach is temporarily unavailable due to a network error. Please try again shortly.");
        } catch (Exception e) {
            log.error("Groq API unexpected error: {}", e.getMessage(), e);
            throw new AIServiceUnavailableException(
                    "AI Coach is temporarily unavailable. Please try again shortly.");
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private List<Map<String, String>> getRecentHistory(User user) {
        return adviceHistoryRepository
                .findTop10ByUserIdOrderByCreatedAtDesc(user.getId()).stream()
                .sorted(Comparator.comparing(AdviceHistory::getCreatedAt))
                .map(h -> Map.of("role", h.getRole(), "content", h.getMessage()))
                .collect(Collectors.toList());
    }

    private void saveHistory(User user, String role, String text) {
        try {
            adviceHistoryRepository.save(AdviceHistory.builder()
                    .user(user)
                    .role(role)
                    .message(text)
                    .createdAt(LocalDateTime.now())
                    .build());
        } catch (Exception e) {
            // Non-critical — history save failure should never break the chat response
            log.warn("Failed to save advice history for user {}: {}", user.getId(), e.getMessage());
        }
    }

    private User getCurrentUser() {
        UserDetails userDetails = (UserDetails) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        return userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new UserNotFoundException("Authenticated user not found."));
    }
}