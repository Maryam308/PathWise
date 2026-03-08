package com.pathwise.backend.config;

import com.pathwise.backend.dto.*;
import com.pathwise.backend.enums.*;
import com.pathwise.backend.model.Goal;
import com.pathwise.backend.model.User;
import com.pathwise.backend.model.MonthlyExpense;
import com.pathwise.backend.model.Simulation;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.time.LocalDateTime;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

@Component
public class TestDataFactory {

    public static User createTestUser() {
        return User.builder()
                .id(UUID.randomUUID())
                .fullName("Test User")
                .email("test@example.com")
                .passwordHash("hashedPassword")
                .phone("+97312345678")
                .monthlySalary(new BigDecimal("2000.000"))
                .preferredCurrency("BHD")
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
    }

    public static User createOtherUser() {
        return User.builder()
                .id(UUID.randomUUID())
                .fullName("Other User")
                .email("other@example.com")
                .passwordHash("hashedPassword")
                .phone("+97387654321")
                .monthlySalary(new BigDecimal("3000.000"))
                .preferredCurrency("BHD")
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
    }

    public static Goal createTestGoal(User user) {
        return Goal.builder()
                .id(UUID.randomUUID())
                .name("Emergency Fund")
                .category(GoalCategory.EMERGENCY_FUND)
                .targetAmount(new BigDecimal("5000.000"))
                .savedAmount(new BigDecimal("1000.000"))
                .deadline(YearMonth.now().plusYears(1))
                .priority(GoalPriority.HIGH)
                .status(GoalStatus.ON_TRACK)
                .currency("BHD")
                .user(user)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
    }

    public static GoalRequest createValidGoalRequest() {
        GoalRequest request = new GoalRequest();
        request.setName("Emergency Fund");
        request.setCategory(GoalCategory.EMERGENCY_FUND);
        request.setTargetAmount(new BigDecimal("5000.000"));
        request.setSavedAmount(new BigDecimal("1000.000"));
        request.setDeadline(YearMonth.now().plusYears(1));
        request.setPriority(GoalPriority.HIGH);
        request.setCurrency("BHD");
        return request;
    }

    public static GoalResponse createGoalResponse() {
        return GoalResponse.builder()
                .id(UUID.randomUUID())
                .name("Emergency Fund")
                .category(GoalCategory.EMERGENCY_FUND)
                .targetAmount(new BigDecimal("5000.000"))
                .savedAmount(new BigDecimal("1000.000"))
                .deadline(YearMonth.now().plusYears(1))
                .priority(GoalPriority.HIGH)
                .status(GoalStatus.ON_TRACK)
                .progressPercentage(20.0)
                .currency("BHD")
                .build();
    }

    public static RegisterRequest createValidRegisterRequest() {
        RegisterRequest request = new RegisterRequest();
        request.setFullName("New User");
        request.setEmail("new@example.com");
        request.setPassword("password123");
        request.setPhone("+97312345678");
        request.setMonthlySalary(new BigDecimal("2000.000"));
        return request;
    }

    public static LoginRequest createValidLoginRequest() {
        LoginRequest request = new LoginRequest();
        request.setEmail("test@example.com");
        request.setPassword("password");
        return request;
    }

    public static AuthResponse createAuthResponse() {
        return AuthResponse.builder()
                .token("test-jwt-token")
                .email("test@example.com")
                .fullName("Test User")
                .userId(UUID.randomUUID())
                .build();
    }

    public static MonthlyExpense createTestExpense(User user) {
        return MonthlyExpense.builder()
                .id(UUID.randomUUID())
                .user(user)
                .label("Rent")
                .category(ExpenseCategory.HOUSING)
                .amount(new BigDecimal("500.000"))
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
    }

    public static Simulation createTestSimulation(User user, Goal goal) {
        return Simulation.builder()
                .id(UUID.randomUUID())
                .user(user)
                .goal(goal)
                .monthlyContribution(new BigDecimal("200.000"))
                .projectedCompletionDate(LocalDate.now().plusYears(2))
                .createdAt(LocalDateTime.now())
                .build();
    }

    // ChatRequest has only: message (no conversationId field)
    public static ChatRequest createValidChatRequest() {
        ChatRequest request = new ChatRequest();
        request.setMessage("How can I save more money?");
        return request;
    }

    // ChatResponse has: message, role, timestamp (no conversationId field)
    public static ChatResponse createChatResponse() {
        return ChatResponse.builder()
                .message("Here are some tips to save money...")
                .role("assistant")
                .timestamp(java.time.LocalDateTime.now())
                .build();
    }

    // SimulationRequest uses currentMonthlySavingsTarget + spendingAdjustments
    public static SimulationRequest createValidSimulationRequest(UUID goalId) {
        SimulationRequest request = new SimulationRequest();
        request.setGoalId(goalId);
        request.setCurrentMonthlySavingsTarget(new BigDecimal("200.000"));
        request.setSpendingAdjustments(Map.of(
                "FOOD", new BigDecimal("80.000"),
                "SUBSCRIPTIONS", new BigDecimal("25.000")
        ));
        return request;
    }

    // SimulationResponse uses goalId, goalName, simulatedMonthlySavingsTarget, etc.
    public static SimulationResponse createSimulationResponse(UUID goalId) {
        return SimulationResponse.builder()
                .goalId(goalId)
                .goalName("Emergency Fund")
                .targetAmount(new BigDecimal("5000.000"))
                .savedAmount(new BigDecimal("1000.000"))
                .currentMonthlySavingsTarget(new BigDecimal("200.000"))
                .baselineMonths(20)
                .simulatedMonthlySavingsTarget(new BigDecimal("305.000"))
                .simulatedMonths(14)
                .monthsSaved(6)
                .totalAdjustment(new BigDecimal("105.000"))
                .disposableIncome(new BigDecimal("1500.000"))
                .remainingDisposableAfterSimulation(new BigDecimal("1195.000"))
                .warningLevel("NONE")
                .build();
    }
}