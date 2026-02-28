package com.pathwise.backend.controller;

import com.pathwise.backend.model.User;
import com.pathwise.backend.repository.MonthlyExpenseRepository;
import com.pathwise.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/expenses")
@RequiredArgsConstructor
public class ExpenseController {

    private final MonthlyExpenseRepository expenseRepository;
    private final UserRepository           userRepository;

    /**
     * GET /api/expenses
     * Returns all monthly expenses for the authenticated user.
     * Response: [{ id, category, label, amount }]
     */
    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getExpenses() {
        User user = getCurrentUser();

        List<Map<String, Object>> expenses = expenseRepository
                .findByUserId(user.getId())
                .stream()
                .map(e -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    // getId() returns UUID — convert to String so JSON is clean
                    row.put("id",       e.getId() != null ? e.getId().toString() : null);
                    row.put("category", e.getCategory() != null ? e.getCategory().toString() : "OTHER");
                    row.put("label",    e.getLabel());
                    row.put("amount",   e.getAmount());
                    return row;
                })
                .collect(Collectors.toList());

        return ResponseEntity.ok(expenses);
    }

    // ── Helper ────────────────────────────────────────────────────────────────
    private User getCurrentUser() {
        UserDetails ud = (UserDetails) SecurityContextHolder
                .getContext().getAuthentication().getPrincipal();
        return userRepository.findByEmail(ud.getUsername())
                .orElseThrow(() -> new RuntimeException("Authenticated user not found"));
    }
}