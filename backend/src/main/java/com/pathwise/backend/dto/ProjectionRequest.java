package com.pathwise.backend.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.*;
import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProjectionRequest {

    @NotNull(message = "Monthly savings rate is required")
    @Positive(message = "Monthly savings rate must be greater than zero")
    private BigDecimal monthlySavingsRate;
}