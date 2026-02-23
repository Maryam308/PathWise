package com.pathwise.backend.dto;

import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import com.pathwise.backend.enums.GoalCategory;
import com.pathwise.backend.enums.GoalPriority;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GoalRequest {
    private String name;
    private GoalCategory category;
    private BigDecimal targetAmount;
    private BigDecimal savedAmount;
    private String currency;
    private LocalDate deadline;
    private GoalPriority priority;
    private UUID userId;
}