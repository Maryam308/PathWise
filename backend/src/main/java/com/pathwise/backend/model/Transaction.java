package com.pathwise.backend.model;

import jakarta.persistence.*;
import lombok.*;
import com.pathwise.backend.enums.TransactionType;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "transactions")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Transaction {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne
    @JoinColumn(name = "account_id")
    private Account account;

    @ManyToOne
    @JoinColumn(name = "category_id")
    private TransactionCategory category;

    private String plaidTransactionId;
    private String merchantName;
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    private TransactionType type;

    private String currency;
    private LocalDate transactionDate;
    private String aiCategoryRaw;
    private LocalDateTime createdAt;
}