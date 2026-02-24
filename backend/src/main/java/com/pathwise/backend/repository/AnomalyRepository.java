package com.pathwise.backend.repository;

import com.pathwise.backend.model.Anomaly;
import com.pathwise.backend.enums.SeverityLevel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.UUID;

@Repository
public interface AnomalyRepository extends JpaRepository<Anomaly, UUID> {
    List<Anomaly> findByUserIdAndIsDismissedFalse(UUID userId);
    List<Anomaly> findByUserId(UUID userId);
    List<Anomaly> findByUserIdAndSeverity(UUID userId, SeverityLevel severity);
}