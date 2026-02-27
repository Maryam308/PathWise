package com.pathwise.backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

import com.pathwise.backend.enums.GoalCategory;
import com.pathwise.backend.enums.GoalPriority;
import com.pathwise.backend.enums.GoalStatus;

@Entity
@Table(name = "goals")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Goal {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne
    @JoinColumn(name = "user_id")
    private User user;

    private String name;

    @Enumerated(EnumType.STRING)
    private GoalCategory category;

    // ── Amounts ───────────────────────────────────────────────────────────────

    /** The total amount the user wants to save for this goal  */
    private BigDecimal targetAmount;

    /** How much the user has already saved toward this goal to date. */
    private BigDecimal savedAmount;

    /** How much the user plans to save toward THIS specific goal per month. */
    private BigDecimal monthlySavingsTarget;

    private String currency;
    private LocalDate deadline;

    @Enumerated(EnumType.STRING)
    private GoalPriority priority;

    @Enumerated(EnumType.STRING)
    private GoalStatus status;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}