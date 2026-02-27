package com.pathwise.backend.dto;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class ProjectionResponse {

    private UUID      goalId;
    private String    goalName;
    private BigDecimal targetAmount;
    private BigDecimal savedAmount;
    private BigDecimal monthlySavingsTarget;

    // ── Results ───────────────────────────────────────────────────────────────
    private long      monthsNeeded;
    private LocalDate projectedCompletionDate;
    private LocalDate goalDeadline;
    private boolean   isOnTrack;
    private long      monthsAheadOrBehind;   // positive = ahead, negative = behind

    // ── Chart: cumulative savings curve ──────────────────────────────────────
    private List<ChartPoint> chartData;

    @Data
    public static class ChartPoint {
        private final String month;       // "2025-06"
        private final BigDecimal amount;  // cumulative saved by that month
    }

    // ── Financial context (informational — never blocks) ──────────────────────
    private BigDecimal monthlySalary;
    private BigDecimal disposableIncome;
    private BigDecimal remainingAfterThisSaving;  // disposable - monthlySavingsTarget
    private BigDecimal totalMonthlyCommitment;    // all goals combined
    private String     warningLevel;              // "NONE"|"AMBER"|"RED"
    private String     warningMessage;
    private String     affordabilityNote;         // plain text for this specific target
}