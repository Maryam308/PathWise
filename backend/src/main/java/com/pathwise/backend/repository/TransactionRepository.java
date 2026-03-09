package com.pathwise.backend.repository;

import com.pathwise.backend.model.Account;
import com.pathwise.backend.model.Transaction;
import com.pathwise.backend.enums.TransactionType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TransactionRepository extends 
    JpaRepository<Transaction, UUID>, 
    JpaSpecificationExecutor<Transaction> {

    List<Transaction> findByAccountUserId(UUID userId);

    List<Transaction> findByAccountUserIdAndTransactionDateBetween(
        UUID userId, LocalDate start, LocalDate end
    );
    
    List<Transaction> findByAccountAndTransactionDateBetween(
        Account account, LocalDate start, LocalDate end
    );

    boolean existsByPlaidTransactionId(String plaidTransactionId);
    
    boolean existsByAccountAndTypeAndTransactionDateBetween(
        Account account, TransactionType type, LocalDate startDate, LocalDate endDate
    );
    
    @Query("SELECT t FROM Transaction t WHERE t.account = :account ORDER BY t.transactionDate DESC LIMIT 1")
    Optional<Transaction> findTopByAccountOrderByTransactionDateDesc(Account account);
    
    // NEW METHOD: Count transactions by account ID
    @Query("SELECT COUNT(t) FROM Transaction t WHERE t.account.id = :accountId")
    long countByAccountId(UUID accountId);
    
    // Alternative if you prefer passing Account object
    default long countByAccount(Account account) {
        return countByAccountId(account.getId());
    }
}