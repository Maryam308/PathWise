package com.pathwise.backend.controller;

import com.pathwise.backend.dto.AccountResponse;
import com.pathwise.backend.exception.UserNotFoundException;
import com.pathwise.backend.model.Account;
import com.pathwise.backend.model.User;
import com.pathwise.backend.repository.AccountRepository;
import com.pathwise.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/profile")
@RequiredArgsConstructor
public class ProfileController {

    private final UserRepository userRepository;
    private final AccountRepository accountRepository;

    @GetMapping
    public ResponseEntity<Map<String, Object>> getProfile() {
        User user = getCurrentUser();
        Optional<Account> account = accountRepository.findByUserId(user.getId());

        AccountResponse cardInfo = account.map(a -> AccountResponse.builder()
                .id(a.getId())
                .bankName(a.getBankName())
                .cardType(a.getCardType() != null ? a.getCardType().name() : null)
                .cardHolderName(a.getCardHolderName())
                .maskedNumber(a.getMaskedNumber())
                .expiryMonth(a.getExpiryMonth())
                .expiryYear(a.getExpiryYear())
                .balance(a.getBalance())
                .currency(a.getCurrency())
                .build()).orElse(null);

        return ResponseEntity.ok(Map.of(
                "fullName", user.getFullName(),
                "email", user.getEmail(),
                "phone", user.getPhone() != null ? user.getPhone() : "",
                "preferredCurrency", user.getPreferredCurrency(),
                "linkedCard", cardInfo != null ? cardInfo : Map.of()
        ));
    }

    private User getCurrentUser() {
        UserDetails userDetails = (UserDetails) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        return userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new UserNotFoundException("User not found"));
    }
}