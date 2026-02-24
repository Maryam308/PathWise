package com.pathwise.backend.service;

import com.pathwise.backend.dto.ChatRequest;
import com.pathwise.backend.dto.ChatResponse;
import com.pathwise.backend.dto.GoalRequest;
import com.pathwise.backend.enums.GoalCategory;
import com.pathwise.backend.enums.GoalPriority;
import com.pathwise.backend.exception.UserNotFoundException;
import com.pathwise.backend.model.AdviceHistory;
import com.pathwise.backend.model.ConversationState;
import com.pathwise.backend.model.Goal;
import com.pathwise.backend.model.User;
import com.pathwise.backend.repository.AdviceHistoryRepository;
import com.pathwise.backend.repository.GoalRepository;
import com.pathwise.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class AICoachService {

    private final UserRepository userRepository;
    private final GoalRepository goalRepository;
    private final AdviceHistoryRepository adviceHistoryRepository;
    private final GoalService goalService;
    private final RestTemplate restTemplate;

    @Value("${groq.api-key}")
    private String groqApiKey;

    @Value("${groq.url}")
    private String groqUrl;

    @Value("${groq.model}")
    private String groqModel;

    private final Map<UUID, ConversationState> conversationSessions = new ConcurrentHashMap<>();

    private User getCurrentUser() {
        UserDetails userDetails = (UserDetails) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        return userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new UserNotFoundException("User not found"));
    }

    public ChatResponse chat(ChatRequest request) {
        User currentUser = getCurrentUser();
        String userMessage = request.getMessage().trim();

        // Save user message
        adviceHistoryRepository.save(AdviceHistory.builder()
                .user(currentUser)
                .role("USER")
                .message(userMessage)
                .createdAt(LocalDateTime.now())
                .build());

        ConversationState state = conversationSessions.getOrDefault(
                currentUser.getId(),
                ConversationState.builder().step("IDLE").build()
        );

        String aiResponse = processMessage(state, userMessage, currentUser);

        // Save AI response
        adviceHistoryRepository.save(AdviceHistory.builder()
                .user(currentUser)
                .role("ASSISTANT")
                .message(aiResponse)
                .createdAt(LocalDateTime.now())
                .build());

        return ChatResponse.builder()
                .message(aiResponse)
                .role("ASSISTANT")
                .timestamp(LocalDateTime.now())
                .build();
    }

    private String processMessage(ConversationState state, String message, User user) {
        return switch (state.getStep()) {
            case "COLLECTING_NAME" -> handleCollectingName(state, message, user);
            case "COLLECTING_AMOUNT" -> handleCollectingAmount(state, message, user);
            case "COLLECTING_DEADLINE" -> handleCollectingDeadline(state, message, user);
            case "COLLECTING_PRIORITY" -> handleCollectingPriority(state, message, user);
            case "CONFIRMING" -> handleConfirmation(state, message, user);
            default -> handleIdle(state, message, user);
        };
    }

    // ─── IDLE — detect intent ──────────────────────────────────────────────

    private String handleIdle(ConversationState state, String message, User user) {
        String lower = message.toLowerCase();
        boolean wantsGoal = lower.contains("create a goal") ||
                lower.contains("new goal") ||
                lower.contains("save for") ||
                lower.contains("want to save") ||
                lower.contains("i want to buy") ||
                lower.contains("planning to buy") ||
                lower.contains("want to create") ||
                lower.contains("add a goal");

        if (wantsGoal) {
            state.setStep("COLLECTING_NAME");
            conversationSessions.put(user.getId(), state);
            return "Let's set up your new goal! 🎯\n\nWhat would you like to name it? " +
                    "For example: 'Buy a Car', 'Travel to Japan', 'Emergency Fund'";
        }

        // Normal AI chat
        List<AdviceHistory> history = adviceHistoryRepository
                .findTop10ByUserIdOrderByCreatedAtAsc(user.getId());
        List<Goal> goals = goalRepository.findByUserId(user.getId());
        return callGroq(history, buildSystemPrompt(user, goals));
    }

    // ─── STEP 1: Name ─────────────────────────────────────────────────────

    private String handleCollectingName(ConversationState state, String message, User user) {
        String lower = message.toLowerCase();

        if (lower.contains("don't know") || lower.contains("not sure") ||
                lower.contains("idk") || lower.contains("no idea") ||
                lower.contains("suggest")) {
            return "Here are some popular goals to inspire you:\n\n" +
                    "🚗 Car — Toyota Camry (~BD 8,000), Honda Accord (~BD 9,500), Tesla Model 3 (~BD 14,000)\n" +
                    "🏠 House — Apartment down payment (~BD 20,000-40,000)\n" +
                    "✈️ Travel — Japan (~BD 1,500), Europe (~BD 2,500)\n" +
                    "📚 Education — Masters degree (~BD 5,000-15,000)\n" +
                    "🛡️ Emergency Fund — 6 months expenses (~BD 3,000-6,000)\n\n" +
                    "Which one appeals to you? Or tell me your own idea!";
        }

        state.setGoalName(message);
        state.setStep("COLLECTING_AMOUNT");
        conversationSessions.put(user.getId(), state);

        return "Great choice — **" + message + "**! 💪\n\n" +
                "How much do you need to save in total? (in BHD)\n" +
                "If you're not sure, I can help you estimate.";
    }

    // ─── STEP 2: Amount ───────────────────────────────────────────────────

    private String handleCollectingAmount(ConversationState state, String message, User user) {
        String lower = message.toLowerCase();

        if (lower.contains("not sure") || lower.contains("don't know") ||
                lower.contains("help") || lower.contains("estimate")) {
            String name = state.getGoalName().toLowerCase();
            return suggestAmount(name);
        }

        try {
            String cleaned = message.replaceAll("[^0-9.]", "");
            if (cleaned.isEmpty()) throw new NumberFormatException();

            BigDecimal amount = new BigDecimal(cleaned);
            state.setTargetAmount(amount);
            state.setStep("COLLECTING_DEADLINE");
            conversationSessions.put(user.getId(), state);

            return "BD " + amount + " — noted! 💰\n\n" +
                    "By when do you want to achieve this goal?\n" +
                    "Please enter a date (YYYY-MM-DD), for example: 2027-06-01";
        } catch (Exception e) {
            return "Please enter a valid amount in BHD, for example: **5000**";
        }
    }

    // ─── STEP 3: Deadline ─────────────────────────────────────────────────

    private String handleCollectingDeadline(ConversationState state, String message, User user) {
        try {
            LocalDate date = LocalDate.parse(message.trim());

            if (date.isBefore(LocalDate.now())) {
                return "That date is in the past! Please enter a future date (YYYY-MM-DD).";
            }

            state.setDeadline(message.trim());
            state.setStep("COLLECTING_PRIORITY");
            conversationSessions.put(user.getId(), state);

            return "Deadline set to **" + message.trim() + "** 📅\n\n" +
                    "What's the priority of this goal?\n\n" +
                    "- **HIGH** — This is urgent and important\n" +
                    "- **MEDIUM** — Important but not urgent\n" +
                    "- **LOW** — Nice to have someday";
        } catch (Exception e) {
            return "Please enter the date in YYYY-MM-DD format.\nExample: **2027-06-01**";
        }
    }

    // ─── STEP 4: Priority ─────────────────────────────────────────────────

    private String handleCollectingPriority(ConversationState state, String message, User user) {
        String priority = message.trim().toUpperCase();

        if (!List.of("HIGH", "MEDIUM", "LOW").contains(priority)) {
            return "Please reply with **HIGH**, **MEDIUM**, or **LOW**.";
        }

        state.setPriority(priority);
        state.setCategory(detectCategory(state.getGoalName()));
        state.setStep("CONFIRMING");
        conversationSessions.put(user.getId(), state);

        return "Here's your goal summary 📋\n\n" +
                "• Name: " + state.getGoalName() + "\n" +
                "• Target: BD " + state.getTargetAmount() + "\n" +
                "• Deadline: " + state.getDeadline() + "\n" +
                "• Priority: " + state.getPriority() + "\n" +
                "• Category: " + state.getCategory() + "\n\n" +
                "Shall I create this goal for you? (Y/N)";
    }

    // ─── STEP 5: Confirm ──────────────────────────────────────────────────

    private String handleConfirmation(ConversationState state, String message, User user) {
        String response = message.trim().toUpperCase();

        if (response.equals("Y") || response.equals("YES")) {
            try {
                GoalRequest goalRequest = GoalRequest.builder()
                        .name(state.getGoalName())
                        .category(GoalCategory.valueOf(state.getCategory()))
                        .targetAmount(state.getTargetAmount())
                        .savedAmount(BigDecimal.ZERO)
                        .currency("BHD")
                        .deadline(LocalDate.parse(state.getDeadline()))
                        .priority(GoalPriority.valueOf(state.getPriority()))
                        .build();

                goalService.createGoalForUser(goalRequest, user);
                conversationSessions.remove(user.getId());

                return "✅ Goal created! **" + state.getGoalName() + "** is now in your dashboard.\n\n" +
                        "Would you like tips on how to reach it faster?";

            } catch (Exception e) {
                log.error("Failed to create goal: {}", e.getMessage());
                conversationSessions.remove(user.getId());
                return "Something went wrong. Please try creating the goal from your dashboard.";
            }

        } else if (response.equals("N") || response.equals("NO")) {
            conversationSessions.remove(user.getId());
            return "No problem! Goal was not created. Feel free to ask me anything else. 😊";
        } else {
            return "Please reply with **Y** to create the goal or **N** to cancel.";
        }
    }



    // ─── Helpers ──────────────────────────────────────────────────────────

    private String suggestAmount(String goalName) {
        if (goalName.contains("car") || goalName.contains("tesla") || goalName.contains("vehicle")) {
            return "Here are typical car prices in Bahrain:\n\n" +
                    "🚗 Toyota Camry — ~BD 8,000\n" +
                    "🚗 Honda Accord — ~BD 9,500\n" +
                    "🚗 Tesla Model 3 — ~BD 14,000\n" +
                    "🚗 Tesla Model Y — ~BD 17,000\n\n" +
                    "How much would you like to save?";
        }
        if (goalName.contains("house") || goalName.contains("apartment")) {
            return "Typical down payments in Bahrain:\n\n" +
                    "🏠 Studio apartment — ~BD 15,000\n" +
                    "🏠 1-bedroom — ~BD 20,000\n" +
                    "🏠 2-bedroom — ~BD 30,000\n\n" +
                    "How much are you targeting?";
        }
        if (goalName.contains("travel") || goalName.contains("trip")) {
            return "Typical travel budgets from Bahrain:\n\n" +
                    "✈️ Weekend Gulf trip — ~BD 500\n" +
                    "✈️ Japan — ~BD 1,500\n" +
                    "✈️ Europe — ~BD 2,500\n\n" +
                    "How much would you like to save?";
        }
        return "How much would you like to save in total? (enter amount in BHD)";
    }

    private String detectCategory(String goalName) {
        String lower = goalName.toLowerCase();
        if (lower.contains("house") || lower.contains("apartment") || lower.contains("home"))
            return "HOUSE";
        if (lower.contains("car") || lower.contains("tesla") || lower.contains("vehicle"))
            return "CAR";
        if (lower.contains("travel") || lower.contains("trip") || lower.contains("vacation"))
            return "TRAVEL";
        if (lower.contains("education") || lower.contains("study") || lower.contains("university"))
            return "EDUCATION";
        if (lower.contains("business") || lower.contains("startup"))
            return "BUSINESS";
        if (lower.contains("emergency") || lower.contains("fund"))
            return "EMERGENCY_FUND";
        return "CUSTOM";
    }

    public ChatResponse getWeeklyAdvice() {
        User currentUser = getCurrentUser();
        List<Goal> goals = goalRepository.findByUserId(currentUser.getId());

        String systemPrompt = buildSystemPrompt(currentUser, goals);
        String weeklyMessage = buildWeeklyAdvicePrompt(currentUser);

        List<AdviceHistory> weeklyHistory = new ArrayList<>();
        weeklyHistory.add(AdviceHistory.builder()
                .role("USER")
                .message(weeklyMessage)
                .build());

        String advice = callGroq(weeklyHistory, systemPrompt);

        adviceHistoryRepository.save(AdviceHistory.builder()
                .user(currentUser)
                .role("ASSISTANT")
                .message(advice)
                .createdAt(LocalDateTime.now())
                .build());

        return ChatResponse.builder()
                .message(advice)
                .role("ASSISTANT")
                .timestamp(LocalDateTime.now())
                .build();
    }

    private String callGroq(List<AdviceHistory> history, String systemPrompt) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(groqApiKey);

            List<Map<String, String>> messages = new ArrayList<>();
            messages.add(Map.of("role", "system", "content", systemPrompt));

            for (AdviceHistory h : history) {
                messages.add(Map.of(
                        "role", h.getRole().equals("USER") ? "user" : "assistant",
                        "content", h.getMessage()
                ));
            }

            Map<String, Object> requestBody = Map.of(
                    "model", groqModel,
                    "messages", messages,
                    "max_tokens", 500,
                    "temperature", 0.7
            );

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);
            Map response = restTemplate.postForObject(groqUrl, entity, Map.class);

            List choices = (List) response.get("choices");
            Map firstChoice = (Map) choices.get(0);
            Map msg = (Map) firstChoice.get("message");
            return (String) msg.get("content");

        } catch (Exception e) {
            log.error("Groq call failed: {}", e.getMessage());
            throw new RuntimeException("AI service is currently unavailable. Please try again later.");
        }
    }

    private String buildSystemPrompt(User user, List<Goal> goals) {
        StringBuilder sb = new StringBuilder();
        sb.append("You are PathWise, a personal AI financial coach for a Bahraini banking app. ");
        sb.append("Always use BHD currency. Be concise, helpful, and encouraging. ");
        sb.append("Give specific advice, not generic tips. Keep responses under 120 words.\n\n");
        sb.append("User: ").append(user.getFullName()).append("\n");

        if (!goals.isEmpty()) {
            sb.append("Goals:\n");
            for (Goal goal : goals) {
                sb.append("- ").append(goal.getName())
                        .append(" | Target: BD ").append(goal.getTargetAmount())
                        .append(" | Saved: BD ").append(goal.getSavedAmount())
                        .append(" | Deadline: ").append(goal.getDeadline())
                        .append(" | Status: ").append(goal.getStatus()).append("\n");
            }
        } else {
            sb.append("User has no goals yet.\n");
        }

        return sb.toString();
    }

    private String buildWeeklyAdvicePrompt(User user) {
        return "Give " + user.getFullName() + " a weekly check-in with 3 specific tips " +
                "based on their goals. Focus on this week. Keep it under 120 words.";
    }
}