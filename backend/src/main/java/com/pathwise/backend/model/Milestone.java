package com.pathwise.backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "milestones")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Milestone {
    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne
    @JoinColumn(name = "goal_id")
    private Goal goal;

    private String title;
    private LocalDate targetDate;
    private Boolean isCompleted;
    private LocalDateTime createdAt;
}