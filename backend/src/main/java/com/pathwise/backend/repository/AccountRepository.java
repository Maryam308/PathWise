package com.pathwise.backend.repository;
import java.util.Optional;
import com.pathwise.backend.model.Account;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.UUID;

@Repository
public interface AccountRepository extends JpaRepository<Account, UUID> {
    Optional<Account> findByUserId(UUID userId);
    boolean existsByPlaidAccountId(String plaidAccountId);
}