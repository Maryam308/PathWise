package com.pathwise.backend.dto;

import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AnomalyResponse {
    private UUID id;
    private String category;
    private String severity;
    private String message;
    private BigDecimal actualAmount;
    private BigDecimal baselineAmount;
    private boolean isDismissed;
    private LocalDateTime createdAt;
}