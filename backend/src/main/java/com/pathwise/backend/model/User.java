package com.pathwise.backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "users")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {
    @Id
    @GeneratedValue
    private UUID id;
    private String fullName;
    private String email;
    private String passwordHash;
    private String preferredCurrency;
    private LocalDateTime createdAt;
}