package com.pathwise.backend.repository;

import com.pathwise.backend.model.MonthlyExpense;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Repository
public interface MonthlyExpenseRepository extends JpaRepository<MonthlyExpense, UUID> {

    List<MonthlyExpense> findByUserId(UUID userId);

    void deleteByUserId(UUID userId);

    @Query("SELECT COALESCE(SUM(e.amount), 0) FROM MonthlyExpense e WHERE e.user.id = :userId")
    BigDecimal sumByUserId(@Param("userId") UUID userId);
}