package com.pathwise.backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "users")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue
    private UUID id;

    private String fullName;

    @Column(unique = true, nullable = false)
    private String email;

    private String passwordHash;

    @Column(nullable = false)
    private String phone;

    private String preferredCurrency;   // default "BHD"

    /**
     * Monthly net salary in BHD. Required at registration.
     *
     * This is the foundation of all financial calculations in Feature 2:
     *
     *   disposableIncome  =  monthlySalary  -  SUM(monthly_expenses.amount)
     *   savingsRate%      =  SUM(goals.monthlySavingsTarget) / disposableIncome * 100
     *
     * If user declares no expenses, disposableIncome = monthlySalary (safe default).
     * Used by FinancialProfileService, AICoachService, ProjectionService, SimulationService.
     */
    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal monthlySalary;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;    // added — was missing from original
}