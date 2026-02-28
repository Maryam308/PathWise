package com.pathwise.backend.dto;

import com.pathwise.backend.enums.ExpenseCategory;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.Data;
import java.math.BigDecimal;
import java.util.List;

@Data
public class RegisterRequest {

    @NotBlank(message = "Full name is required")
    @Size(min = 2, max = 100)
    private String fullName;

    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    private String email;

    @NotBlank(message = "Password is required")
    @Size(min = 8, message = "Password must be at least 8 characters")
    private String password;

    @NotBlank(message = "Phone number is required")
    private String phone;

    private String preferredCurrency = "BHD";

    @NotNull(message = "Monthly salary is required")
    @DecimalMin(value = "0.01", message = "Monthly salary must be greater than zero")
    private BigDecimal monthlySalary;

    // Optional — null/empty list means no declared expenses → disposableIncome = salary
    @Valid
    private List<ExpenseItem> monthlyExpenses;

    @Data
    public static class ExpenseItem {

        @NotNull(message = "Expense category is required")
        private ExpenseCategory category;

        @NotNull(message = "Expense amount is required")
        @DecimalMin(value = "0.01", message = "Amount must be greater than zero")
        private BigDecimal amount;

        @Size(max = 100)
        private String label;   // optional e.g. "Seef apartment", "Netflix + Shahid"
    }
}