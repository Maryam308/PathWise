package com.pathwise.backend.model;

import jakarta.persistence.*;
import lombok.*;
import com.pathwise.backend.enums.SeverityLevel;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "anomalies")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Anomaly {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne
    @JoinColumn(name = "user_id")
    private User user;

    @ManyToOne
    @JoinColumn(name = "category_id")
    private TransactionCategory category;

    @ManyToOne
    @JoinColumn(name = "transaction_id")
    private Transaction transaction;

    @Enumerated(EnumType.STRING)
    private SeverityLevel severity;

    private String message;
    private BigDecimal actualAmount;
    private BigDecimal baselineAmount;
    private Boolean isDismissed;
    private LocalDateTime createdAt;
}