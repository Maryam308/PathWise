package com.pathwise.backend.repository;

import com.pathwise.backend.model.Anomaly;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.UUID;

@Repository
public interface AnomalyRepository extends JpaRepository<Anomaly, UUID> {
    List<Anomaly> findByUserIdAndIsDismissedFalseOrderByCreatedAtDesc(UUID userId);
    List<Anomaly> findByUserIdOrderByCreatedAtDesc(UUID userId);
}