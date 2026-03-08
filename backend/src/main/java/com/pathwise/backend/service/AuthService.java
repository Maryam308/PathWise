package com.pathwise.backend.service;

import com.pathwise.backend.dto.AuthResponse;
import com.pathwise.backend.dto.LoginRequest;
import com.pathwise.backend.dto.RegisterRequest;
import com.pathwise.backend.exception.EmailAlreadyExistsException;
import com.pathwise.backend.exception.InvalidCredentialsException;
import com.pathwise.backend.model.User;
import com.pathwise.backend.enums.ExpenseCategory;
import org.springframework.dao.DataIntegrityViolationException;
import com.pathwise.backend.exception.InvalidExpenseDataException;
import com.pathwise.backend.repository.UserRepository;
import com.pathwise.backend.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;


@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final FinancialProfileService financialProfileService;

    @Transactional
    public AuthResponse register(RegisterRequest request) {

        // Normalise email to lowercase to prevent duplicate accounts
        // differing only by case (e.g. User@example.com vs user@example.com)
        String email = request.getEmail().trim().toLowerCase();

        if (userRepository.existsByEmail(email)) {
            throw new EmailAlreadyExistsException(
                    "Invalid email or password");
        }


        // Validate phone number format (8 digits)
        if (request.getPhone() == null || !request.getPhone().matches("^[0-9]{8}$")) {
            throw new IllegalArgumentException("Phone number must be exactly 8 digits");
        }

        // Check if phone number already exists
        if (userRepository.existsByPhone(request.getPhone())) {
            throw new IllegalArgumentException("This phone number is already registered with another account.");
        }

        // Validate total expenses don't exceed salary
        if (request.getMonthlyExpenses() != null && !request.getMonthlyExpenses().isEmpty()) {
            BigDecimal totalExpenses = request.getMonthlyExpenses()
                    .stream()
                    .map(RegisterRequest.ExpenseItem::getAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            if (totalExpenses.compareTo(request.getMonthlySalary()) > 0) {
                throw new InvalidExpenseDataException(
                        "Total monthly expenses (BD " + totalExpenses +
                                ") cannot exceed monthly salary (BD " + request.getMonthlySalary() + ")"
                );
            }
        }

        // Validate no duplicate categories
        if (request.getMonthlyExpenses() != null && !request.getMonthlyExpenses().isEmpty()) {
            List<ExpenseCategory> categories = request.getMonthlyExpenses()
                    .stream()
                    .map(RegisterRequest.ExpenseItem::getCategory)
                    .collect(Collectors.toList());

            Set<ExpenseCategory> uniqueCategories = new HashSet<>(categories);
            if (uniqueCategories.size() != categories.size()) {
                throw new InvalidExpenseDataException("Duplicate expense categories are not allowed");
            }
        }


        User user = User.builder()
                .fullName(request.getFullName().trim())
                .email(email)
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .phone(request.getPhone())                           // optional, may be null
                .preferredCurrency(request.getPreferredCurrency() != null
                        ? request.getPreferredCurrency() : "BHD")
                .monthlySalary(request.getMonthlySalary())           // @NotNull enforced by Bean Validation
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        try {
            user = userRepository.save(user);
        } catch (DataIntegrityViolationException e) {
            // This catches any database constraint violation
            if (e.getMessage().contains("phone")) {
                throw new IllegalArgumentException("This phone number is already registered with another account.");
            }
            throw e;
        }

        // Save monthly expenses in the same @Transactional scope.
        // If monthlyExpenses is null or empty → nothing saved → expenses = BD 0.
        // Rolls back together with the user save if anything fails.
        if (request.getMonthlyExpenses() != null && !request.getMonthlyExpenses().isEmpty()) {
            financialProfileService.saveExpenses(user.getId(), request.getMonthlyExpenses());
        }

        return AuthResponse.builder()
                .token(jwtUtil.generateToken(user.getEmail()))
                .email(user.getEmail())
                .fullName(user.getFullName())
                .userId(user.getId())
                .phone(user.getPhone())
                .build();
    }

    public AuthResponse login(LoginRequest request) {
        String email = request.getEmail().trim().toLowerCase();

        // Same generic error for wrong email AND wrong password intentionally —
        // prevents user enumeration attacks.
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new InvalidCredentialsException("Invalid email or password."));

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new InvalidCredentialsException("Invalid email or password.");
        }

        return AuthResponse.builder()
                .token(jwtUtil.generateToken(user.getEmail()))
                .email(user.getEmail())
                .fullName(user.getFullName())
                .userId(user.getId())
                .build();
    }
}