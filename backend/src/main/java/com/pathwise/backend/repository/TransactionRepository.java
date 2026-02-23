package com.pathwise.backend.repository;

import com.pathwise.backend.model.Transaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public interface TransactionRepository extends JpaRepository<Transaction, UUID> {

    List<Transaction> findByAccountUserId(UUID userId);
    List<Transaction> findByAccountUserIdAndTransactionDateBetween(
        UUID userId, LocalDate start, LocalDate end
    );

    boolean existsByPlaidTransactionId(String plaidTransactionId);
}