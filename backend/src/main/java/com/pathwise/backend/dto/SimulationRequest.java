package com.pathwise.backend.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.*;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SimulationRequest {

    @NotNull(message = "Goal ID is required")
    private UUID goalId;

    @NotNull(message = "Current monthly savings rate is required")
    @Positive(message = "Monthly savings rate must be greater than zero")
    private BigDecimal currentMonthlySavingsRate;

    @NotNull(message = "Adjustments are required")
    @NotEmpty(message = "At least one adjustment is required")
    private Map<String, BigDecimal> adjustments;

    private String name;
}