package com.pathwise.backend.repository;

import com.pathwise.backend.model.Report;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public interface ReportRepository extends JpaRepository<Report, UUID> {
    List<Report> findByUserIdOrderByCreatedAtDesc(UUID userId);
    long countByUserIdAndCreatedAtGreaterThanEqual(
        UUID userId, java.time.LocalDateTime from
    );
}