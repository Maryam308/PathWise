package com.pathwise.backend.repository;

import com.pathwise.backend.model.Account;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AccountRepository extends JpaRepository<Account, UUID> {
    Optional<Account> findByUserId(UUID userId);
    boolean existsByPlaidAccountId(String plaidAccountId);
    
    // Find accounts that need salary update (last update was before current month)
    @Query("SELECT a FROM Account a WHERE a.lastSalaryUpdate IS NULL OR a.lastSalaryUpdate < :firstDayOfMonth")
    List<Account> findAccountsNeedingSalaryUpdate(LocalDate firstDayOfMonth);
    
    // Get all accounts for scheduled tasks
    List<Account> findAll();
}