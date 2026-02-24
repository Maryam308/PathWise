package com.pathwise.backend.service;

import com.pathwise.backend.dto.TransactionResponse;
import com.pathwise.backend.exception.UserNotFoundException;
import com.pathwise.backend.model.User;
import com.pathwise.backend.repository.TransactionRepository;
import com.pathwise.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
@RequiredArgsConstructor
public class TransactionService {

    private final TransactionRepository transactionRepository;
    private final UserRepository userRepository;

    private User getCurrentUser() {
        UserDetails userDetails = (UserDetails) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        return userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new UserNotFoundException("User not found"));
    }

    public List<TransactionResponse> getUserTransactions() {
        User user = getCurrentUser();
        return transactionRepository.findByAccountUserId(user.getId())
                .stream()
                .map(txn -> TransactionResponse.builder()
                        .id(txn.getId())
                        .merchantName(txn.getMerchantName())
                        .amount(txn.getAmount())
                        .type(txn.getType().name())
                        .currency(txn.getCurrency())
                        .transactionDate(txn.getTransactionDate())
                        .category(txn.getCategory() != null ?
                                txn.getCategory().getName() : "OTHER")
                        .categoryIcon(txn.getCategory() != null ?
                                txn.getCategory().getIcon() : "💳")
                        .build())
                .toList();
    }
}