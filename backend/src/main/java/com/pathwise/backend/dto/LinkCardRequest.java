package com.pathwise.backend.dto;

import com.pathwise.backend.enums.BahrainBank;
import com.pathwise.backend.enums.CardType;
import jakarta.validation.constraints.*;
import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LinkCardRequest {

    @NotNull(message = "Bank is required")
    private BahrainBank bank;

    @NotNull(message = "Card type is required")
    private CardType cardType;

    @NotBlank(message = "Card holder name is required")
    private String cardHolderName;

    // 4 groups of 4 digits
    @NotBlank(message = "Card number is required")
    @Pattern(regexp = "^\\d{4}$", message = "Please enter the last 4 digits of your card")
    private String lastFourDigits;

    @Min(value = 1, message = "Invalid expiry month")
    @Max(value = 12, message = "Invalid expiry month")
    @NotNull(message = "Expiry month is required")
    private Integer expiryMonth;

    @NotNull(message = "Expiry year is required")
    private Integer expiryYear;
}