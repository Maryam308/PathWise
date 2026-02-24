package com.pathwise.backend.model;

import lombok.*;
import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConversationState {
    private String step;
    private String goalName;
    private BigDecimal targetAmount;
    private String deadline;
    private String priority;
    private String category;
}