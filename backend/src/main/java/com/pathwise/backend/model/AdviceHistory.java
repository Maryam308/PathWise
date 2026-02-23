package com.pathwise.backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "advice_history")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AdviceHistory {
    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne
    @JoinColumn(name = "user_id")
    private User user;

    private String role;
    private String message;
    private LocalDateTime createdAt;
}