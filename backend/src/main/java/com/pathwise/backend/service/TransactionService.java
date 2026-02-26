package com.pathwise.backend.service;

import com.pathwise.backend.dto.TransactionResponse;
import com.pathwise.backend.exception.UserNotFoundException;
import com.pathwise.backend.model.Transaction;
import com.pathwise.backend.model.User;
import com.pathwise.backend.repository.TransactionRepository;
import com.pathwise.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class TransactionService {

    private final TransactionRepository transactionRepository;
    private final UserRepository userRepository;

    public Page<TransactionResponse> getTransactions(
            String search, String category, Integer month, Integer year, Pageable pageable) {

        User user = getCurrentUser();

        LocalDate start = null;
        LocalDate end = null;
        if (month != null && year != null) {
            start = LocalDate.of(year, month, 1);
            end = start.withDayOfMonth(start.lengthOfMonth());
        }

        List<Transaction> all = (start != null)
                ? transactionRepository.findByAccountUserIdAndTransactionDateBetween(
                user.getId(), start, end)
                : transactionRepository.findByAccountUserId(user.getId());

        // Filter by search and category in memory (simple, avoids complex JPA queries)
        List<Transaction> filtered = all.stream()
                .filter(t -> search == null || search.isBlank() ||
                        (t.getMerchantName() != null &&
                                t.getMerchantName().toLowerCase().contains(search.toLowerCase())))
                .filter(t -> category == null || category.isBlank() ||
                        (t.getCategory() != null &&
                                t.getCategory().getName().equalsIgnoreCase(category)))
                .sorted((a, b) -> b.getTransactionDate().compareTo(a.getTransactionDate()))
                .toList();

        // Manual pagination
        int start2 = (int) pageable.getOffset();
        int end2 = Math.min(start2 + pageable.getPageSize(), filtered.size());
        List<Transaction> page = (start2 > filtered.size()) ? List.of() : filtered.subList(start2, end2);

        List<TransactionResponse> responses = page.stream().map(this::toResponse).toList();
        return new PageImpl<>(responses, pageable, filtered.size());
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