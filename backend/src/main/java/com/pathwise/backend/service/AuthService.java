package com.pathwise.backend.service;

import com.pathwise.backend.dto.AuthResponse;
import com.pathwise.backend.dto.LoginRequest;
import com.pathwise.backend.dto.RegisterRequest;
import com.pathwise.backend.exception.EmailAlreadyExistsException;
import com.pathwise.backend.exception.InvalidCredentialsException;
import com.pathwise.backend.model.User;
import com.pathwise.backend.repository.UserRepository;
import com.pathwise.backend.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

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
                    "An account with this email already exists.");
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

        user = userRepository.save(user);

        // Save monthly expenses in the same @Transactional scope.
        // If monthlyExpenses is null or empty → nothing saved → expenses = BD 0.
        // Rolls back together with the user save if anything fails.
        financialProfileService.saveExpenses(user.getId(), request.getMonthlyExpenses());

        return AuthResponse.builder()
                .token(jwtUtil.generateToken(user.getEmail()))
                .email(user.getEmail())
                .fullName(user.getFullName())
                .userId(user.getId())
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