package com.pathwise.backend.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Size;
import lombok.Data;
import java.math.BigDecimal;
import jakarta.validation.constraints.Pattern;

/**
 * Request body for PUT /api/profile.
 * All fields are optional — only non-null values are applied.
 */
@Data
public class UpdateProfileRequest {

    @Size(min = 2, max = 100, message = "Full name must be between 2 and 100 characters")
    private String fullName;

    @Pattern(regexp = "^[0-9]{8}$", message = "Phone number must be exactly 8 digits")
    private String phone;

    private String preferredCurrency;

    @DecimalMin(value = "0.01", message = "Monthly salary must be greater than zero")
    private BigDecimal monthlySalary;
}