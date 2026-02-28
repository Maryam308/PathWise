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

    @Column(nullable = false)
    private String fullName;

    @Column(unique = true, nullable = false)
    private String email;

    @Column(nullable = false)
    private String passwordHash;

    @Column(nullable = false)
    private String phone;               // required at registration

    @Column(nullable = false)
    @Builder.Default
    private String preferredCurrency = "BHD";

    /**
     * Required at registration. Foundation of all savings calculations:
     *   disposableIncome = monthlySalary - SUM(monthly_expenses)
     *   savingsRate%     = SUM(goals.monthlySavingsTarget) / disposableIncome * 100
     */
    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal monthlySalary;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;
}