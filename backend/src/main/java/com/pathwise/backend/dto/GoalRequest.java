package com.pathwise.backend.dto;

import lombok.*;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import com.pathwise.backend.enums.GoalCategory;
import com.pathwise.backend.enums.GoalPriority;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GoalRequest {

    @NotBlank(message = "Goal name is required")
    private String name;

    @NotNull(message = "Category is required")
    private GoalCategory category;

    @NotNull(message = "Target amount is required")
    @DecimalMin(value = "0.01", message = "Target amount must be greater than zero")
    private BigDecimal targetAmount;

    @DecimalMin(value = "0.00", message = "Saved amount cannot be negative")
    private BigDecimal savedAmount;

    private String currency;

    @NotNull(message = "Deadline is required")
    @Future(message = "Deadline must be a future date")
    private LocalDate deadline;

    @NotNull(message = "Priority is required")
    private GoalPriority priority;

    /**
     * How much the user plans to save toward THIS goal per month (BHD).
     * Optional on creation — can be set/updated later via the projection endpoint.
     * When set, GoalService uses it to calculate status (ON_TRACK vs AT_RISK).
     */
    @DecimalMin(value = "0.01", message = "Monthly savings target must be greater than zero")
    private BigDecimal monthlySavingsTarget;
}