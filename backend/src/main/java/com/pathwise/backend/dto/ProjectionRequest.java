package com.pathwise.backend.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.math.BigDecimal;

@Data
public class ProjectionRequest {

    /**
     * How much the user plans to save toward this goal per month.
     * Named monthlySavingsRate to match existing ProjectionController.
     */
    @NotNull(message = "Monthly savings rate is required")
    @DecimalMin(value = "0.01", message = "Must be greater than zero")
    private BigDecimal monthlySavingsRate;
}