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

        if (userRepository.existsByEmail(request.getEmail())) {
            throw new EmailAlreadyExistsException("An account with this email already exists.");
        }

        User user = User.builder()
                .fullName(request.getFullName())
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .phone(request.getPhone())
                .preferredCurrency(request.getPreferredCurrency() != null
                        ? request.getPreferredCurrency() : "BHD")
                .monthlySalary(request.getMonthlySalary())
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        user = userRepository.save(user);

        // Save monthly expenses in the same transaction.
        // If null/empty → no rows saved → expenses treated as BD 0.
        financialProfileService.saveExpenses(user.getId(), request.getMonthlyExpenses());

        String token = jwtUtil.generateToken(user.getEmail());

        return AuthResponse.builder()
                .token(token)
                .email(user.getEmail())
                .fullName(user.getFullName())
                .userId(user.getId())
                .build();
    }

    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new InvalidCredentialsException("Invalid email or password."));

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new InvalidCredentialsException("Invalid email or password.");
        }

        String token = jwtUtil.generateToken(user.getEmail());

        return AuthResponse.builder()
                .token(token)
                .email(user.getEmail())
                .fullName(user.getFullName())
                .userId(user.getId())
                .build();
    }
}