package com.pathwise.backend.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "simulations")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Simulation {
    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne
    @JoinColumn(name = "user_id")
    private User user;

    @ManyToOne
    @JoinColumn(name = "goal_id")
    private Goal goal;

    private String name;

    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Double> adjustments;

    private LocalDate baselineDate;
    private LocalDate simulatedDate;
    private Integer monthsSaved;
    private LocalDateTime createdAt;
}