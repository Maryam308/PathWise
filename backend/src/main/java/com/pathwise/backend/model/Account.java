package com.pathwise.backend.model;

import com.pathwise.backend.enums.BahrainBank;
import com.pathwise.backend.enums.CardType;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "accounts")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Account {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne
    @JoinColumn(name = "user_id")
    private User user;

    // Plaid fields
    private String plaidAccountId;
    private String plaidAccessToken;

    // Card details (saved locally, only masked number sent to Plaid)
    @Enumerated(EnumType.STRING)
    private BahrainBank bank;

    @Enumerated(EnumType.STRING)
    private CardType cardType;

    private String cardHolderName;
    private String maskedNumber;   // "****1234"
    private Integer expiryMonth;
    private Integer expiryYear;

    // Account info
    private String bankName;       
    private String accountType;   
    private BigDecimal balance;
    private String currency;
    private LocalDateTime createdAt;
}