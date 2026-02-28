package com.pathwise.backend.controller;

import com.pathwise.backend.dto.AccountResponse;
import com.pathwise.backend.dto.RegisterRequest;
import com.pathwise.backend.dto.UpdateProfileRequest;
import com.pathwise.backend.exception.UserNotFoundException;
import com.pathwise.backend.model.Account;
import com.pathwise.backend.model.User;
import com.pathwise.backend.repository.AccountRepository;
import com.pathwise.backend.repository.UserRepository;
import com.pathwise.backend.service.FinancialProfileService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/profile")
@RequiredArgsConstructor
public class ProfileController {

    private final UserRepository userRepository;
    private final AccountRepository accountRepository;
    private final FinancialProfileService financialProfileService;

    /**
     * GET /api/profile
     * Returns user info, linked card, and financial snapshot in one response.
     * Merges the original card/account info with the new financial profile data.
     */
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

        FinancialProfileService.FinancialSnapshot snap =
                financialProfileService.getSnapshot(user);

        return ResponseEntity.ok(Map.of(
                "fullName",          user.getFullName(),
                "email",             user.getEmail(),
                "phone",             user.getPhone(),
                "preferredCurrency", user.getPreferredCurrency(),
                "monthlySalary",     user.getMonthlySalary(),
                "linkedCard",        cardInfo != null ? cardInfo : Map.of(),
                "financialSnapshot", Map.of(
                        "disposableIncome",     snap.disposableIncome(),
                        "totalMonthlyExpenses", snap.totalExpenses(),
                        "totalMonthlySavings",  snap.totalMonthlySavings(),
                        "savingsRatePercent",   snap.savingsRatePercent() != null
                                ? snap.savingsRatePercent() : 0.0,
                        "warningLevel",         snap.warningLevel().name(),
                        "warningMessage",       snap.warningMessage() != null
                                ? snap.warningMessage() : ""
                )
        ));
    }

    /**
     * PUT /api/profile
     * Updates fullName, phone, preferredCurrency, and/or monthlySalary.
     * Only non-null fields are applied (partial update — patch semantics).
     */
    @PutMapping
    public ResponseEntity<Map<String, Object>> updateProfile(
            @Valid @RequestBody UpdateProfileRequest request) {
        User user = getCurrentUser();

        if (request.getFullName() != null)   user.setFullName(request.getFullName().trim());
        if (request.getPhone() != null)       user.setPhone(request.getPhone());
        if (request.getPreferredCurrency() != null)
            user.setPreferredCurrency(request.getPreferredCurrency());
        if (request.getMonthlySalary() != null)
            user.setMonthlySalary(request.getMonthlySalary());

        user.setUpdatedAt(LocalDateTime.now());
        User saved = userRepository.save(user);

        return ResponseEntity.ok(Map.of(
                "fullName",          saved.getFullName(),
                "email",             saved.getEmail(),
                "phone",             saved.getPhone(),
                "preferredCurrency", saved.getPreferredCurrency(),
                "monthlySalary",     saved.getMonthlySalary()
        ));
    }

    /**
     * GET /api/profile/expenses
     * Returns the user's current monthly expense declarations + financial snapshot.
     */
    @GetMapping("/expenses")
    public ResponseEntity<FinancialProfileService.FinancialSnapshot> getExpenses() {
        User user = getCurrentUser();
        return ResponseEntity.ok(financialProfileService.getSnapshot(user));
    }

    /**
     * PUT /api/profile/expenses
     * Replaces ALL of the user's monthly expense declarations atomically.
     * Send [] to clear all expenses — disposable income will then equal salary.
     */
    @PutMapping("/expenses")
    public ResponseEntity<Void> updateExpenses(
            @Valid @RequestBody List<RegisterRequest.ExpenseItem> expenses) {
        User user = getCurrentUser();
        financialProfileService.replaceExpenses(user.getId(), expenses);
        return ResponseEntity.noContent().build();
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private User getCurrentUser() {
        UserDetails userDetails = (UserDetails) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        return userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new UserNotFoundException("User not found"));
    }
}