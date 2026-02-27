package com.pathwise.backend.dto;

import lombok.*;
import java.math.BigDecimal;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AccountResponse {
    private UUID id;
    private String bankName;
    private String cardType;
    private String cardHolderName;
    private String maskedNumber;
    private Integer expiryMonth;
    private Integer expiryYear;
    private BigDecimal balance;
    private String currency;
}