package com.pathwise.backend.dto;

import com.pathwise.backend.enums.GoalCategory;
import com.pathwise.backend.enums.GoalPriority;
import com.pathwise.backend.enums.GoalStatus;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class GoalResponse {

    // ── Goal fields ───────────────────────────────────────────────────────────
    private UUID id;
    private String name;
    private GoalCategory category;
    private BigDecimal targetAmount;
    private BigDecimal savedAmount;
    private BigDecimal monthlySavingsTarget;
    private String currency;
    private LocalDate deadline;
    private GoalPriority priority;
    private GoalStatus status;
    private Double progressPercentage;

    // ── Financial profile snapshot (same on every goal — whole-user picture) ──

    /** User's monthly net salary (null if not set) */
    private BigDecimal monthlySalary;

    /** Sum of all declared fixed monthly expenses */
    private BigDecimal totalMonthlyExpenses;

    /**
     * Disposable income = salary - totalMonthlyExpenses.
     * Null if salary not set.
     * This is the realistic ceiling for savings capacity.
     */
    private BigDecimal disposableIncome;

    /** Sum of monthlySavingsTarget across all active (non-completed) goals */
    private BigDecimal totalMonthlyCommitment;

    /**
     * totalMonthlyCommitment as a % of disposableIncome.
     * Null if disposableIncome is unknown (salary not set).
     */
    private Double savingsRatePercent;

    /**
     * Warning level based on savings rate vs disposable income:
     *   "NONE"  → savings rate <= 30%     → no banner shown
     *   "AMBER" → savings rate 30–50%     → yellow banner
     *   "RED"   → savings rate > 50%,
     *             OR savings > disposable,
     *             OR expenses > salary    → red banner
     */
    private String warningLevel;

    /**
     * Human-readable warning message for the frontend banner.
     * Null when warningLevel = "NONE".
     *
     * Examples:
     *   AMBER: "You're planning to save 38% of your disposable income (BD 760/month).
     *           This is ambitious — keep a buffer for unexpected expenses."
     *   RED:   "Your monthly savings commitment (BD 900) exceeds your disposable
     *           income (BD 750). Extend your goal deadlines or reduce monthly targets."
     */
    private String warningMessage;

    // ── Timestamps ────────────────────────────────────────────────────────────
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}