package com.pathwise.backend.service;

import com.pathwise.backend.dto.RegisterRequest;
import com.pathwise.backend.exception.UserNotFoundException;
import com.pathwise.backend.model.MonthlyExpense;
import com.pathwise.backend.model.User;
import com.pathwise.backend.repository.GoalRepository;
import com.pathwise.backend.repository.MonthlyExpenseRepository;
import com.pathwise.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class FinancialProfileService {

    private final MonthlyExpenseRepository expenseRepository;
    private final GoalRepository           goalRepository;
    private final UserRepository           userRepository;

    // ── Expense management ────────────────────────────────────────────────────

    /**
     * Called from AuthService.register() within the same @Transactional scope.
     * Silently skips null/empty list — disposable income will then equal salary.
     */
    @Transactional
    public void saveExpenses(UUID userId, List<RegisterRequest.ExpenseItem> items) {
        if (items == null || items.isEmpty()) return;

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException("User not found: " + userId));

        List<MonthlyExpense> expenses = items.stream()
                .filter(i -> i.getAmount() != null && i.getAmount().compareTo(BigDecimal.ZERO) > 0)
                .map(i -> MonthlyExpense.builder()
                        .user(user)
                        .category(i.getCategory())
                        .amount(i.getAmount())
                        .label(i.getLabel() != null ? i.getLabel().trim() : null)
                        .createdAt(LocalDateTime.now())
                        .updatedAt(LocalDateTime.now())
                        .build())
                .collect(Collectors.toList());

        if (!expenses.isEmpty()) {
            expenseRepository.saveAll(expenses);
        }
    }

    /**
     * Called from ProfileController when user edits their expenses.
     * Replaces all existing rows atomically.
     */
    @Transactional
    public void replaceExpenses(UUID userId, List<RegisterRequest.ExpenseItem> items) {
        // Verify user exists before wiping their expenses
        if (!userRepository.existsById(userId)) {
            throw new UserNotFoundException("User not found: " + userId);
        }
        expenseRepository.deleteByUserId(userId);
        saveExpenses(userId, items);
    }

    // ── Disposable income helpers (used by GoalService to check limits) ───────

    /**
     * Returns the user's disposable income = salary - total fixed expenses.
     * Always returns a value — salary is required so this is never null.
     */
    public BigDecimal getDisposableIncome(User user) {
        BigDecimal expenses = expenseRepository.sumByUserId(user.getId());
        return user.getMonthlySalary().subtract(expenses);
    }

    /**
     * Returns total monthly savings committed across all active goals for a user.
     * Returns ZERO if no targets have been set.
     */
    public BigDecimal getTotalMonthlySavings(UUID userId) {
        return goalRepository.sumMonthlySavingsTargetByUserId(userId);
    }

    // ── Full snapshot ─────────────────────────────────────────────────────────

    /**
     * The single source of truth for financial health calculations.
     * Called by GoalService, ProjectionService, SimulationService, AICoachService.
     *
     * Warning thresholds (standard personal finance guidelines):
     *   expenses >= salary      → RED   (no disposable income at all)
     *   savings  >= disposable  → RED   (100% or more of disposable committed)
     *   savingsRate > 50%       → RED   (unsustainable — very aggressive)
     *   savingsRate 30–50%      → AMBER (ambitious — watch it)
     *   savingsRate <= 30%      → NONE  (healthy range)
     */
    public FinancialSnapshot getSnapshot(User user) {
        BigDecimal salary     = user.getMonthlySalary();                               // never null
        BigDecimal expenses   = expenseRepository.sumByUserId(user.getId());           // 0 if none declared
        BigDecimal disposable = salary.subtract(expenses);                             // always calculable
        BigDecimal savings    = goalRepository.sumMonthlySavingsTargetByUserId(user.getId()); // 0 if no targets

        Double savingsRate = null;
        if (disposable.compareTo(BigDecimal.ZERO) > 0 && savings.compareTo(BigDecimal.ZERO) > 0) {
            savingsRate = savings.divide(disposable, 4, RoundingMode.HALF_UP)
                    .doubleValue() * 100;
        }

        WarningLevel level = WarningLevel.NONE;
        String message = null;

        if (disposable.compareTo(BigDecimal.ZERO) <= 0) {
            level = WarningLevel.RED;
            message = String.format(
                    "Your fixed expenses (BD %.3f) meet or exceed your salary (BD %.3f). " +
                            "There is no room for savings until you reduce your fixed costs.",
                    expenses, salary);
        } else if (savings.compareTo(disposable) >= 0) {
            level = WarningLevel.RED;
            message = String.format(
                    "Your total monthly savings commitment (BD %.3f) meets or exceeds your " +
                            "disposable income (BD %.3f). Reduce your monthly targets or extend goal deadlines.",
                    savings, disposable);
        } else if (savingsRate != null && savingsRate > 50) {
            level = WarningLevel.RED;
            message = String.format(
                    "You are planning to save %.0f%% of your disposable income (BD %.3f/month). " +
                            "This is very aggressive. Consider extending your goal timelines.",
                    savingsRate, disposable);
        } else if (savingsRate != null && savingsRate > 30) {
            level = WarningLevel.AMBER;
            message = String.format(
                    "You are planning to save %.0f%% of your disposable income (BD %.3f/month). " +
                            "This is ambitious — keep a buffer for unexpected costs.",
                    savingsRate, disposable);
        }

        return new FinancialSnapshot(salary, expenses, disposable, savings, savingsRate, level, message);
    }

    // ── Types ─────────────────────────────────────────────────────────────────

    public record FinancialSnapshot(
            BigDecimal salary,
            BigDecimal totalExpenses,
            BigDecimal disposableIncome,       // always present — salary is required
            BigDecimal totalMonthlySavings,    // sum of active goal monthly targets
            Double     savingsRatePercent,     // null if disposable == 0 or savings == 0
            WarningLevel warningLevel,
            String warningMessage
    ) {}

    public enum WarningLevel { NONE, AMBER, RED }
}