package com.pathwise.backend.repository;

import com.pathwise.backend.model.TransactionCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TransactionCategoryRepository 
    extends JpaRepository<TransactionCategory, UUID> {
    Optional<TransactionCategory> findByName(String name);
}