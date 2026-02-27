package com.pathwise.backend.dto;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Data
@Builder
public class SimulationResponse {

    private UUID      goalId;
    private String    goalName;
    private BigDecimal targetAmount;
    private BigDecimal savedAmount;

    // ── Baseline ──────────────────────────────────────────────────────────────
    private BigDecimal currentMonthlySavingsTarget;
    private LocalDate  baselineCompletionDate;
    private long       baselineMonths;

    // ── Simulated ─────────────────────────────────────────────────────────────
    private Map<String, BigDecimal> spendingAdjustments;
    private BigDecimal totalAdjustment;
    private BigDecimal simulatedMonthlySavingsTarget;
    private LocalDate  simulatedCompletionDate;
    private long       simulatedMonths;
    private long       monthsSaved;   // baselineMonths - simulatedMonths

    // ── Charts ────────────────────────────────────────────────────────────────
    private List<ChartPoint> baselineChart;
    private List<ChartPoint> simulatedChart;

    @Data
    public static class ChartPoint {
        private final String month;
        private final BigDecimal amount;
    }

    // ── Financial context ─────────────────────────────────────────────────────
    private BigDecimal disposableIncome;
    private BigDecimal remainingDisposableAfterSimulation;  // negative = over-committed
    private String     affordabilityNote;
    private String     warningLevel;
}
