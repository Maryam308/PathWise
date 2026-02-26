package com.pathwise.backend.dto;

import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TransactionResponse {
    private UUID id;
    private String merchantName;
    private BigDecimal amount;
    private String type;
    private String currency;
    private LocalDate transactionDate;
    private String category;
    private String categoryIcon;
    private String categoryColor;
}