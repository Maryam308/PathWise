package com.pathwise.backend.dto;

import jakarta.validation.constraints.*;
import lombok.Data;
import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

@Data
public class SimulationRequest {

    @NotNull(message = "Goal ID is required")
    private UUID goalId;

    /**
     * The user's current monthly savings rate for this goal.
     * This is the baseline the simulation compares against.
     */
    @NotNull(message = "Current monthly savings target is required")
    @DecimalMin(value = "0.01", message = "Must be greater than zero")
    private BigDecimal currentMonthlySavingsTarget;

    /**
     * Category → BD amount the user would cut per month.
     * e.g. { "FOOD": 80.00, "SUBSCRIPTIONS": 25.00 }
     *
     * The freed-up amount gets added to the monthly savings target:
     *   simulatedMonthly = currentMonthly + SUM(adjustments.values())
     */
    @NotEmpty(message = "At least one spending adjustment is required")
    private Map<String, BigDecimal> spendingAdjustments;
}