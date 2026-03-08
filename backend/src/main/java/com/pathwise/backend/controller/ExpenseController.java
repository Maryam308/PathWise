package com.pathwise.backend.controller;

import com.pathwise.backend.dto.RegisterRequest;
import com.pathwise.backend.exception.InvalidExpenseDataException;
import com.pathwise.backend.model.User;
import com.pathwise.backend.repository.MonthlyExpenseRepository;
import com.pathwise.backend.repository.UserRepository;
import com.pathwise.backend.service.FinancialProfileService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/expenses")
@RequiredArgsConstructor
public class ExpenseController {

    private final FinancialProfileService    financialProfileService;
    private final UserRepository             userRepository;
    private final MonthlyExpenseRepository   expenseRepository;

    /**
     * GET /api/expenses
     * Returns all monthly expenses for the authenticated user.
     * Response: [{ id, category, label, amount }]
     */
    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getExpenses(
            @AuthenticationPrincipal UserDetails userDetails) {

        User user = userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("User not found"));

        List<Map<String, Object>> expenses = expenseRepository
                .findByUserId(user.getId())
                .stream()
                .map(e -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("id",       e.getId() != null ? e.getId().toString() : null);
                    row.put("category", e.getCategory() != null ? e.getCategory().toString() : "OTHER");
                    row.put("label",    e.getLabel());
                    row.put("amount",   e.getAmount());
                    return row;
                })
                .collect(Collectors.toList());

        return ResponseEntity.ok(expenses);
    }

    /**
     * PUT /api/expenses
     * Replaces all monthly expenses for the authenticated user.
     * Validates that total expenses don't exceed monthly salary and no duplicate categories.
     */
    @PutMapping
    public ResponseEntity<Void> replaceExpenses(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody List<RegisterRequest.ExpenseItem> expenses) {

        User user = userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Validate total expenses don't exceed salary
        if (expenses != null && !expenses.isEmpty()) {
            BigDecimal totalExpenses = expenses.stream()
                    .map(RegisterRequest.ExpenseItem::getAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            if (totalExpenses.compareTo(user.getMonthlySalary()) > 0) {
                throw new InvalidExpenseDataException(
                        "Total monthly expenses (BD " + totalExpenses +
                                ") cannot exceed monthly salary (BD " + user.getMonthlySalary() + ")"
                );
            }

            // Validate no duplicate categories
            List<String> categories = expenses.stream()
                    .map(e -> e.getCategory().name())
                    .collect(Collectors.toList());

            Set<String> uniqueCategories = new HashSet<>(categories);
            if (uniqueCategories.size() != categories.size()) {
                throw new InvalidExpenseDataException("Duplicate expense categories are not allowed");
            }
        }

        financialProfileService.replaceExpenses(user.getId(), expenses);
        return ResponseEntity.ok().build();
    }
}