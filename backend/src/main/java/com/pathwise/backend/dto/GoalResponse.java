package com.pathwise.backend.dto;

import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;
import com.pathwise.backend.enums.GoalCategory;
import com.pathwise.backend.enums.GoalPriority;
import com.pathwise.backend.enums.GoalStatus;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GoalResponse {
    private UUID id;
    private String name;
    private GoalCategory category;
    private BigDecimal targetAmount;
    private BigDecimal savedAmount;
    private String currency;
    private LocalDate deadline;
    private GoalPriority priority;
    private GoalStatus status;
    private double progressPercentage;
    private LocalDateTime createdAt;
}