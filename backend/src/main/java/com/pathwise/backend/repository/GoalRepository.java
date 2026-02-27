package com.pathwise.backend.repository;

import com.pathwise.backend.model.Goal;
import com.pathwise.backend.enums.GoalStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Repository
public interface GoalRepository extends JpaRepository<Goal, UUID> {

    List<Goal> findByUserId(UUID userId);
    List<Goal> findByUserIdAndStatus(UUID userId, GoalStatus status);

    /**
     * Sum of monthlySavingsTarget across all non-completed active goals.
     * Used by FinancialProfileService to calculate total savings commitment.
     * Returns 0 if no targets are set.
     */
    @Query("""
        SELECT COALESCE(SUM(g.monthlySavingsTarget), 0)
        FROM Goal g
        WHERE g.user.id = :userId
          AND g.status != 'COMPLETED'
          AND g.monthlySavingsTarget IS NOT NULL
    """)
    BigDecimal sumMonthlySavingsTargetByUserId(@Param("userId") UUID userId);
}