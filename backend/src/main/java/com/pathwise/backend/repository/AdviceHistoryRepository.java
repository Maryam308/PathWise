package com.pathwise.backend.repository;

import com.pathwise.backend.model.AdviceHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.UUID;

@Repository
public interface AdviceHistoryRepository extends JpaRepository<AdviceHistory, UUID> {
    List<AdviceHistory> findTop10ByUserIdOrderByCreatedAtAsc(UUID userId);
}