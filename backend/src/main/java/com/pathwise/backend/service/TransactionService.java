package com.pathwise.backend.service;

import com.pathwise.backend.dto.TransactionResponse;
import com.pathwise.backend.exception.UserNotFoundException;
import com.pathwise.backend.model.Transaction;
import com.pathwise.backend.model.User;
import com.pathwise.backend.repository.TransactionRepository;
import com.pathwise.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import jakarta.persistence.criteria.Predicate;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class TransactionService {

    private final TransactionRepository transactionRepository;
    private final UserRepository userRepository;

    public Page<TransactionResponse> getTransactions(
            String search, String category, Integer month, Integer year, 
            String sortBy, String sortDir, Pageable pageable) {
        
        User user = getCurrentUser();
        
        Specification<Transaction> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            
            // User filter
            predicates.add(cb.equal(root.get("account").get("user").get("id"), user.getId()));
            
            // Date range filter
            if (month != null && year != null) {
                LocalDate start = LocalDate.of(year, month, 1);
                LocalDate end = start.withDayOfMonth(start.lengthOfMonth());
                predicates.add(cb.between(root.get("transactionDate"), start, end));
            }
            
            // Search by merchant name
            if (search != null && !search.trim().isEmpty()) {
                predicates.add(cb.like(cb.lower(root.get("merchantName")), 
                    "%" + search.toLowerCase() + "%"));
            }
            
            // Category filter
            if (category != null && !category.trim().isEmpty()) {
                predicates.add(cb.equal(root.get("category").get("name"), category));
            }
            
            return cb.and(predicates.toArray(new Predicate[0]));
        };
        
        // Apply sorting
        if (sortBy != null && sortDir != null) {
            Sort sort = Sort.by(Sort.Direction.fromString(sortDir), sortBy);
            pageable = org.springframework.data.domain.PageRequest.of(
                pageable.getPageNumber(), 
                pageable.getPageSize(), 
                sort
            );
        }
        
        Page<Transaction> page = transactionRepository.findAll(spec, pageable);
        
        return page.map(this::toResponse);
    }

    private TransactionResponse toResponse(Transaction t) {
        return TransactionResponse.builder()
                .id(t.getId())
                .merchantName(t.getMerchantName())
                .amount(t.getAmount())
                .type(t.getType().name())
                .currency(t.getCurrency())
                .transactionDate(t.getTransactionDate())
                .category(t.getCategory() != null ? t.getCategory().getName() : "OTHER")
                .categoryIcon(t.getCategory() != null ? t.getCategory().getIcon() : "💳")
                .categoryColor(t.getCategory() != null ? t.getCategory().getColorHex() : "#95A5A6")
                .build();
    }

    private User getCurrentUser() {
        UserDetails userDetails = (UserDetails) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        return userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new UserNotFoundException("User not found"));
    }
}