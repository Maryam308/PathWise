package com.pathwise.backend.model;

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

    private String plaidAccountId;
    private String bankName;
    private String accountType;
    private BigDecimal balance;
    private String currency;
    private String maskedNumber;
    private LocalDateTime createdAt;
}