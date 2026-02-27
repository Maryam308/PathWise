package com.pathwise.backend.service;

import com.pathwise.backend.dto.RegisterRequest;
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

    // ── Setup ─────────────────────────────────────────────────────────────────

    @Transactional
    public void saveExpenses(UUID userId, List<RegisterRequest.ExpenseItem> items) {
        if (items == null || items.isEmpty()) return;
        User user = userRepository.findById(userId).orElseThrow();

        List<MonthlyExpense> expenses = items.stream()
                .filter(i -> i.getAmount() != null && i.getAmount().compareTo(BigDecimal.ZERO) > 0)
                .map(i -> MonthlyExpense.builder()
                        .user(user)
                        .category(i.getCategory())
                        .amount(i.getAmount())
                        .label(i.getLabel())
                        .createdAt(LocalDateTime.now())
                        .updatedAt(LocalDateTime.now())
                        .build())
                .collect(Collectors.toList());

        expenseRepository.saveAll(expenses);
    }

    @Transactional
    public void replaceExpenses(UUID userId, List<RegisterRequest.ExpenseItem> items) {
        expenseRepository.deleteByUserId(userId);
        saveExpenses(userId, items);
    }

    // ── Snapshot ──────────────────────────────────────────────────────────────

    /**
     * The single method everything calls to get the full financial picture.
     *
     *   disposableIncome  =  salary  -  totalExpenses
     *   savingsRate%      =  totalSavings / disposableIncome * 100
     *
     * salary is always present (required at registration) so disposableIncome
     * is always calculable. No null checks needed downstream.
     *
     * Thresholds:
     *   expenses >= salary        → RED
     *   savings  >  disposable    → RED
     *   savingsRate > 50%         → RED
     *   savingsRate 30–50%        → AMBER
     *   savingsRate <= 30%        → NONE
     */
    public FinancialSnapshot getSnapshot(User user) {
        BigDecimal salary     = user.getMonthlySalary();
        BigDecimal expenses   = expenseRepository.sumByUserId(user.getId());
        BigDecimal disposable = salary.subtract(expenses);
        BigDecimal savings    = goalRepository.sumMonthlySavingsTargetByUserId(user.getId());

        Double savingsRate = null;
        if (disposable.compareTo(BigDecimal.ZERO) > 0) {
            if (savings.compareTo(BigDecimal.ZERO) > 0) {
                savingsRate = savings.divide(disposable, 4, RoundingMode.HALF_UP)
                        .doubleValue() * 100;
            } else {
                savingsRate = 0.0;  // No savings target
            }
        }

        WarningLevel level = WarningLevel.NONE;
        String message     = null;

        // Handle case where expenses exceed salary
        if (disposable.compareTo(BigDecimal.ZERO) <= 0) {
            level = WarningLevel.RED;
            message = String.format(
                    "Your fixed expenses (BD %.2f) already meet or exceed your salary (BD %.2f). " +
                            "There is no room for savings until you reduce your fixed costs.",
                    expenses, salary);
        }
        // Handle case where savings exceed disposable income
        else if (savings.compareTo(disposable) > 0) {
            level = WarningLevel.RED;
            message = String.format(
                    "Your total monthly savings commitment (BD %.2f) exceeds your disposable " +
                            "income (BD %.2f). Reduce your monthly targets or extend your goal deadlines.",
                    savings, disposable);
        }
        // Handle case where savings equals disposable income (100% savings rate)
        else if (savings.compareTo(disposable) == 0) {
            level = WarningLevel.RED;
            message = String.format(
                    "You are planning to save 100%% of your disposable income (BD %.2f/month). " +
                            "This leaves no buffer for unexpected expenses. Consider a more balanced approach.",
                    disposable);
        }
        // Handle other cases based on savings rate
        else if (savings.compareTo(BigDecimal.ZERO) > 0) {
            if (savingsRate != null && savingsRate > 50) {
                level = WarningLevel.RED;
                message = String.format(
                        "You are planning to save %.0f%% of your disposable income (BD %.2f/month). " +
                                "This is very aggressive. Consider extending your goal timelines.",
                        savingsRate, disposable);
            } else if (savingsRate != null && savingsRate > 30) {
                level = WarningLevel.AMBER;
                message = String.format(
                        "You are planning to save %.0f%% of your disposable income (BD %.2f/month). " +
                                "This is ambitious — keep a buffer for unexpected costs.",
                        savingsRate, disposable);
            }
        }

        return new FinancialSnapshot(salary, expenses, disposable, savings, savingsRate, level, message);
    }

    // ── Records / Enums ───────────────────────────────────────────────────────

    public record FinancialSnapshot(
            BigDecimal salary,
            BigDecimal totalExpenses,
            BigDecimal disposableIncome,
            BigDecimal totalMonthlySavings,
            Double     savingsRatePercent,
            WarningLevel warningLevel,
            String warningMessage
    ) {}

    public enum WarningLevel { NONE, AMBER, RED }
}