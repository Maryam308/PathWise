package com.pathwise.backend.service;

import com.pathwise.backend.dto.TransactionResponse;
import com.pathwise.backend.enums.TransactionType;
import com.pathwise.backend.exception.UserNotFoundException;
import com.pathwise.backend.model.Transaction;
import com.pathwise.backend.model.User;
import com.pathwise.backend.repository.TransactionRepository;
import com.pathwise.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class TransactionService {

    private final TransactionRepository transactionRepository;
    private final UserRepository userRepository;

    public Page<TransactionResponse> getTransactions(
            String search, 
            String category, 
            String type, 
            Integer month, 
            Integer year,
            String sortBy, 
            String sortDir, 
            Pageable pageable) {

        User user = getCurrentUser();

        // Get all transactions for the user
        List<Transaction> allTransactions;

        if (month != null && year != null) {
            LocalDate start = LocalDate.of(year, month, 1);
            LocalDate end = start.withDayOfMonth(start.lengthOfMonth());
            allTransactions = transactionRepository
                    .findByAccountUserIdAndTransactionDateBetween(user.getId(), start, end);
        } else {
            allTransactions = transactionRepository.findByAccountUserId(user.getId());
        }

        log.info("Before filtering - total transactions: {}", allTransactions.size());
        
        // Count by type for debugging
        long creditCount = allTransactions.stream()
            .filter(t -> t.getType() == TransactionType.CREDIT).count();
        long debitCount = allTransactions.stream()
            .filter(t -> t.getType() == TransactionType.DEBIT).count();
        log.info("Available in all transactions - CREDIT (Income): {}, DEBIT (Expense): {}", creditCount, debitCount);

        // Apply filters
        List<Transaction> filtered = allTransactions.stream()
                .filter(t -> {
                    // Search filter
                    if (search != null && !search.trim().isEmpty()) {
                        String merchant = t.getMerchantName() != null ? t.getMerchantName().toLowerCase() : "";
                        if (!merchant.contains(search.toLowerCase())) {
                            return false;
                        }
                    }
                    // Category filter
                    if (category != null && !category.trim().isEmpty()) {
                        String txnCategory = t.getCategory() != null ? t.getCategory().getName() : "OTHER";
                        if (!txnCategory.equals(category)) {
                            return false;
                        }
                    }
                    // Type filter (CREDIT = Income, DEBIT = Expense)
                    if (type != null && !type.trim().isEmpty()) {
                        if (type.equals("CREDIT") && t.getType() != TransactionType.CREDIT) {
                            return false;
                        }
                        if (type.equals("DEBIT") && t.getType() != TransactionType.DEBIT) {
                            return false;
                        }
                    }
                    return true;
                })
                .collect(Collectors.toList());

        log.info("After filtering - filtered transactions: {}, type filter: {}", filtered.size(), type);

        // Apply sorting
        if (sortBy != null && sortDir != null) {
            Comparator<Transaction> comparator = getComparator(sortBy, sortDir);
            filtered.sort(comparator);
        } else {
            // Default sort by date desc
            filtered.sort((a, b) -> b.getTransactionDate().compareTo(a.getTransactionDate()));
        }

        // Apply pagination
        int start = (int) pageable.getOffset();
        int end = Math.min(start + pageable.getPageSize(), filtered.size());
        List<Transaction> pageContent = start > filtered.size() ?
                List.of() : filtered.subList(start, end);

        List<TransactionResponse> responses = pageContent.stream()
                .map(this::toResponse)
                .collect(Collectors.toList());

        return new PageImpl<>(responses, pageable, filtered.size());
    }

    private Comparator<Transaction> getComparator(String sortBy, String sortDir) {
        Comparator<Transaction> comparator;

        switch (sortBy) {
            case "amount":
                comparator = Comparator.comparing(Transaction::getAmount);
                break;
            case "merchantName":
                comparator = Comparator.comparing(Transaction::getMerchantName,
                        Comparator.nullsLast(String::compareTo));
                break;
            case "transactionDate":
            default:
                comparator = Comparator.comparing(Transaction::getTransactionDate);
                break;
        }

        return sortDir.equalsIgnoreCase("DESC") ? comparator.reversed() : comparator;
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