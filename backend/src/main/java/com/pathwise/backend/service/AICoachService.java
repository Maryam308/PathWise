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

    private static final String GROQ_URL        = "https://api.groq.com/openai/v1/chat/completions";
    private static final String MODEL           = "llama-3.3-70b-versatile";  // Upgraded model
    private static final int    MAX_TOKENS      = 600;    // More room for structured replies
    private static final int    MAX_MESSAGE_LEN = 2000;
    private static final int    HISTORY_LIMIT   = 12;     // More context = more accurate

    // ── Public API ────────────────────────────────────────────────────────────

    public ChatResponse chat(ChatRequest request) {
        if (request.getMessage() == null || request.getMessage().isBlank())
            throw new MessageTooLongException("Message cannot be empty.");
        if (request.getMessage().length() > MAX_MESSAGE_LEN)
            throw new MessageTooLongException("Message exceeds " + MAX_MESSAGE_LEN + " characters.");

        User user = getCurrentUser();
        saveHistory(user, "user", request.getMessage());

        List<Map<String, String>> messages = new ArrayList<>();
        messages.add(Map.of("role", "system", "content", buildSystemPrompt(user)));
        messages.addAll(getRecentHistory(user));
        messages.add(Map.of("role", "user", "content", request.getMessage()));

        String reply = callGroq(messages);

        if (reply != null && !reply.isBlank())
            saveHistory(user, "assistant", reply);

        return ChatResponse.builder()
                .message(reply)
                .role("assistant")
                .timestamp(LocalDateTime.now())
                .build();
    }

    public ChatResponse getWeeklyAdvice() {
        User user = getCurrentUser();

        List<Map<String, String>> messages = List.of(
                Map.of("role", "system", "content", buildSystemPrompt(user)),
                Map.of("role", "user",   "content", buildCheckInPrompt(user))
        );

        String reply = callGroq(messages);

        if (reply != null && !reply.isBlank())
            saveHistory(user, "assistant", reply);

        return ChatResponse.builder()
                .message(reply)
                .role("assistant")
                .timestamp(LocalDateTime.now())
                .build();
    }

    /**
     * Called by the frontend wizard after it creates/updates/deletes a goal directly.
     * Injects a synthetic assistant turn into conversation history so Groq knows
     * the task is complete and won't act on stale intent in the next user message.
     */
    public void notifyGoalAction(String actionType, String goalName) {
        User user = getCurrentUser();
        String summary = switch (actionType) {
            case "CREATE_GOAL" -> "✅ Goal \"" + goalName + "\" was successfully created via the wizard. The goal creation task is now complete. I'm ready to help with something new.";
            case "UPDATE_GOAL" -> "✅ Goal \"" + goalName + "\" was successfully updated via the wizard. The update task is now complete. I'm ready to help with something new.";
            case "DELETE_GOAL" -> "✅ Goal \"" + goalName + "\" was successfully deleted via the wizard. The deletion task is now complete. I'm ready to help with something new.";
            default            -> "✅ Goal action completed via the wizard. I'm ready to help with something new.";
        };
        saveHistory(user, "assistant", summary);
    }



    private String buildSystemPrompt(User user) {
        List<Goal>           goals    = goalRepository.findByUserId(user.getId());
        List<MonthlyExpense> expenses = expenseRepository.findByUserId(user.getId());
        FinancialSnapshot    snap     = financialProfileService.getSnapshot(user);

        String firstName = extractFirstName(user.getFullName());

        StringBuilder sb = new StringBuilder();

        // ── Role ──────────────────────────────────────────────────────────────
        sb.append("""
            You are PathWise AI Coach — a precise, data-driven personal finance assistant \
            for users in Bahrain. You have full access to the user's financial data below. \
            NEVER give generic advice. ALWAYS reference the user's exact BD amounts and goal names.

            """);

        // ── User snapshot ─────────────────────────────────────────────────────
        sb.append("══ USER ══════════════════════════════\n");
        sb.append("Name: ").append(firstName).append("\n");
        sb.append("Currency: BD (Bahraini Dinar) — always use BD, never $\n\n");

        sb.append("══ FINANCES ══════════════════════════\n");
        sb.append("Monthly salary:        BD ").append(snap.salary()).append("\n");
        sb.append("Fixed expenses:        BD ").append(snap.totalExpenses()).append("\n");
        sb.append("Disposable income:     BD ").append(snap.disposableIncome())
                .append("  ← MAX monthly savings ceiling\n");
        sb.append("Committed to goals:    BD ").append(snap.totalMonthlySavings()).append("\n");
        sb.append("Still allocatable:     BD ")
                .append(snap.disposableIncome().subtract(snap.totalMonthlySavings()).max(BigDecimal.ZERO))
                .append("\n");
        if (snap.savingsRatePercent() != null)
            sb.append("Savings rate:          ").append(String.format("%.1f%%", snap.savingsRatePercent()))
                    .append(" of disposable\n");
        if (snap.warningLevel() != FinancialProfileService.WarningLevel.NONE)
            sb.append("⚠ WARNING [").append(snap.warningLevel()).append("]: ")
                    .append(snap.warningMessage()).append("\n");

        if (!expenses.isEmpty()) {
            sb.append("\nExpense breakdown:\n");
            for (MonthlyExpense e : expenses) {
                sb.append("  ").append(e.getCategory()).append(": BD ").append(e.getAmount());
                if (e.getLabel() != null && !e.getLabel().isBlank())
                    sb.append(" (").append(e.getLabel()).append(")");
                sb.append("\n");
            }
        }

        // ── Goals ─────────────────────────────────────────────────────────────
        sb.append("\n══ GOALS (").append(goals.size()).append(") ════════════════════\n");
        if (goals.isEmpty()) {
            sb.append("No goals yet. Offer to help create the first one.\n");
        } else {
            for (Goal g : goals) {
                BigDecimal saved = g.getSavedAmount() != null ? g.getSavedAmount() : BigDecimal.ZERO;
                BigDecimal rem   = g.getTargetAmount().subtract(saved);
                double pct = g.getTargetAmount().compareTo(BigDecimal.ZERO) > 0
                        ? saved.divide(g.getTargetAmount(), 4, java.math.RoundingMode.HALF_UP)
                        .multiply(BigDecimal.valueOf(100)).doubleValue()
                        : 0;

                sb.append("• ID=").append(g.getId())
                        .append(" | \"").append(g.getName()).append("\"\n");
                sb.append("  Category: ").append(g.getCategory())
                        .append(" | Status: ").append(g.getStatus())
                        .append(" | Priority: ").append(g.getPriority()).append("\n");
                sb.append("  Target: BD ").append(g.getTargetAmount())
                        .append(" | Saved: BD ").append(saved)
                        .append(" (").append(String.format("%.1f%%", pct)).append(")")
                        .append(" | Remaining: BD ").append(rem).append("\n");
                sb.append("  Deadline: ").append(g.getDeadline()).append("\n");
                if (g.getMonthlySavingsTarget() != null)
                    sb.append("  Monthly target: BD ").append(g.getMonthlySavingsTarget()).append("\n");
                else
                    sb.append("  Monthly target: NOT SET\n");
            }
        }

        // ── Bahrain context ───────────────────────────────────────────────────
        sb.append("""

            ══ BAHRAIN CONTEXT ══════════════════
            • Typical costs: Car BD 6k–25k, Apartment down-payment BD 15k–40k, \
            Japan trip BD 1.5k–3k, Emergency fund = 3–6× monthly expenses.
            • Local banks: BBK, Ahli United Bank, NBB, Bank of Bahrain and Kuwait.
            • Healthy savings rate: 20–30% of disposable income.

            """);

        // ── Goal CRUD capability ──────────────────────────────────────────────
        sb.append("══ GOAL MANAGEMENT CAPABILITY ════════\n");
        sb.append("""
            You CAN create, update, and delete goals for the user when they ask you to. \
            When performing an action, embed a machine-readable block at the END of your reply:

            ```action
            {
              "type": "CREATE_GOAL",
              "data": {
                "name": "Japan Trip",
                "category": "TRAVEL",
                "targetAmount": 2000,
                "savedAmount": 0,
                "monthlySavingsTarget": 200,
                "currency": "BHD",
                "deadline": "2026-12-31",
                "priority": "MEDIUM"
              }
            }
            ```

            For UPDATE_GOAL, include "id" (the goal's UUID from the GOALS section above).
            For DELETE_GOAL, include "id" and "name".
            Valid categories: HOUSE, CAR, EDUCATION, TRAVEL, EMERGENCY_FUND, BUSINESS, CUSTOM
            Valid priorities: HIGH, MEDIUM, LOW
            Deadline format: YYYY-MM-DD

            IMPORTANT: Only embed the action block when the user explicitly requests a create/update/delete. \
            For advisory questions, never emit action blocks.

            """);

        // ── Behavioural rules ─────────────────────────────────────────────────
        sb.append("══ RULES ═════════════════════════════\n");
        sb.append("1. Always address the user as ").append(firstName).append(".\n");
        sb.append("2. Reference their exact BD amounts and goal names — NEVER generic advice.\n");
        sb.append("3. If warningLevel is RED, address the overspending issue directly but kindly.\n");
        sb.append("4. If a goal has no monthly target, suggest one based on deadline and remaining.\n");
        sb.append("5. Conversational replies: ≤ 130 words. Weekly check-in: ≤ 200 words.\n");
        sb.append("6. You are a planning tool, NOT a licensed financial advisor.\n");
        sb.append("7. When asked to create/update/delete a goal, always confirm details before acting.\n");
        sb.append("8. Format numbers with 3 decimal places: BD X,XXX.XXX\n");
        sb.append("9. VALIDATION — when embedding an action block, enforce:\n");
        sb.append("   - deadline must be AFTER today (" + java.time.LocalDate.now() + "), never in the past\n");
        sb.append("   - savedAmount must be < targetAmount\n");
        sb.append("   - targetAmount > 0, savedAmount >= 0\n");
        sb.append("   - deadline format: YYYY-MM-DD\n");
        sb.append("   - If user gives invalid data, reject it and ask them to correct it before creating.\n");

        return sb.toString();
    }

    private String buildCheckInPrompt(User user) {
        List<Goal>        goals = goalRepository.findByUserId(user.getId());
        FinancialSnapshot snap  = financialProfileService.getSnapshot(user);
        String firstName        = extractFirstName(user.getFullName());

        StringBuilder sb = new StringBuilder();
        sb.append("Give ").append(firstName).append(" a personalised weekly financial check-in.\n\n");
        sb.append("Disposable income: BD ").append(snap.disposableIncome())
                .append(" | Committed to goals: BD ").append(snap.totalMonthlySavings())
                .append(" | Remaining: BD ")
                .append(snap.disposableIncome().subtract(snap.totalMonthlySavings()).max(BigDecimal.ZERO))
                .append("\n\n");

        if (!goals.isEmpty()) {
            sb.append("Goal progress:\n");
            for (Goal g : goals) {
                BigDecimal saved = g.getSavedAmount() != null ? g.getSavedAmount() : BigDecimal.ZERO;
                sb.append("• ").append(g.getName()).append(": BD ").append(saved)
                        .append(" / BD ").append(g.getTargetAmount())
                        .append(" by ").append(g.getDeadline())
                        .append(" [").append(g.getStatus()).append("]\n");
            }
        }

        sb.append("\nGive exactly 3 specific, numbered, actionable tips for this week. ")
                .append("Reference exact goals and BD amounts. Keep total under 200 words.");
        return sb.toString();
    }

    // ── Groq API ──────────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private String callGroq(List<Map<String, String>> messages) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(groqApiKey);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model",       MODEL);
        body.put("max_tokens",  MAX_TOKENS);
        body.put("temperature", 0.4);   // Lower = more precise, less hallucination
        body.put("messages",    messages);

        try {
            ResponseEntity<Map> res = restTemplate.postForEntity(
                    GROQ_URL, new HttpEntity<>(body, headers), Map.class);

            if (res.getBody() == null)
                throw new AIServiceUnavailableException("AI Coach returned an empty response.");

            List<Map<String, Object>> choices =
                    (List<Map<String, Object>>) res.getBody().get("choices");

            if (choices == null || choices.isEmpty())
                throw new AIServiceUnavailableException("AI Coach returned no choices.");

            Map<String, Object> msg = (Map<String, Object>) choices.get(0).get("message");
            return (String) msg.get("content");

        } catch (AIServiceUnavailableException e) {
            throw e;
        } catch (RestClientException e) {
            log.error("Groq API network error: {}", e.getMessage(), e);
            throw new AIServiceUnavailableException(
                    "AI Coach is temporarily unavailable (network error). Please try again shortly.");
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
                .limit(HISTORY_LIMIT)
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
            log.warn("Failed to save advice history for user {}: {}", user.getId(), e.getMessage());
        }
    }

    private String extractFirstName(String fullName) {
        if (fullName == null || fullName.isBlank()) return "there";
        return fullName.contains(" ") ? fullName.split(" ")[0] : fullName;
    }

    private User getCurrentUser() {
        UserDetails userDetails = (UserDetails) SecurityContextHolder
                .getContext().getAuthentication().getPrincipal();
        return userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new UserNotFoundException("Authenticated user not found."));
    }
}