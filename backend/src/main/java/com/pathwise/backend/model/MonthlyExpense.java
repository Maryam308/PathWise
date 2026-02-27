package com.pathwise.backend.model;

import com.pathwise.backend.enums.ExpenseCategory;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * One row per expense category per user.
 * Collected at registration (optional). Editable in profile settings.
 *
 * disposableIncome = user.monthlySalary - SUM(this table for user)
 */
@Entity
@Table(name = "monthly_expenses")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MonthlyExpense {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ExpenseCategory category;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal amount;

    private String label;   // optional e.g. "Seef apartment", "Netflix + Shahid"

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}