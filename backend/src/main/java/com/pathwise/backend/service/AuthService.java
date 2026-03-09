package com.pathwise.backend.service;

import com.pathwise.backend.dto.*;
import com.pathwise.backend.enums.ExpenseCategory;
import com.pathwise.backend.enums.TokenPurpose;
import com.pathwise.backend.exception.EmailAlreadyExistsException;
import com.pathwise.backend.exception.EmailNotVerifiedException;
import com.pathwise.backend.exception.InvalidCredentialsException;
import com.pathwise.backend.exception.InvalidTokenException;
import com.pathwise.backend.exception.InvalidExpenseDataException;
import com.pathwise.backend.model.EmailVerificationToken;
import com.pathwise.backend.model.User;
import com.pathwise.backend.repository.EmailVerificationTokenRepository;
import com.pathwise.backend.repository.UserRepository;
import com.pathwise.backend.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository                  userRepository;
    private final EmailVerificationTokenRepository tokenRepository;
    private final PasswordEncoder                  passwordEncoder;
    private final JwtUtil                          jwtUtil;
    private final FinancialProfileService          financialProfileService;
    private final EmailService                     emailService;

    private static final SecureRandom RANDOM = new SecureRandom();

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** Generates a cryptographically secure 6-digit OTP string, zero-padded. */
    private String generateOtp() {
        return String.format("%06d", RANDOM.nextInt(1_000_000));
    }

    // ── Registration ──────────────────────────────────────────────────────────

    /**
     * Creates the user account and sends an email verification code.
     * The user CANNOT log in until they verify their email.
     *
     * @return a simple message — no JWT is issued here.
     */
    @Transactional
    public MessageResponse register(RegisterRequest request) {

        String email = request.getEmail().trim().toLowerCase();

        // Prevent duplicate accounts — use a generic message to avoid email enumeration
        if (userRepository.existsByEmail(email)) {
            throw new EmailAlreadyExistsException("Invalid email or password");
        }

        if (request.getPhone() == null || !request.getPhone().matches("^[0-9]{8}$")) {
            throw new IllegalArgumentException("Phone number must be exactly 8 digits");
        }

        if (userRepository.existsByPhone(request.getPhone())) {
            throw new IllegalArgumentException("This phone number is already registered with another account.");
        }

        // Validate total expenses ≤ salary
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

        // Validate no duplicate expense categories
        if (request.getMonthlyExpenses() != null && !request.getMonthlyExpenses().isEmpty()) {
            List<ExpenseCategory> categories = request.getMonthlyExpenses()
                    .stream()
                    .map(RegisterRequest.ExpenseItem::getCategory)
                    .collect(Collectors.toList());
            Set<ExpenseCategory> unique = new HashSet<>(categories);
            if (unique.size() != categories.size()) {
                throw new InvalidExpenseDataException("Duplicate expense categories are not allowed");
            }
        }

        User user = User.builder()
                .fullName(request.getFullName().trim())
                .email(email)
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .phone(request.getPhone())
                .preferredCurrency(request.getPreferredCurrency() != null
                        ? request.getPreferredCurrency() : "BHD")
                .monthlySalary(request.getMonthlySalary())
                .emailVerified(false)           // must verify before first login
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        try {
            user = userRepository.save(user);
        } catch (DataIntegrityViolationException e) {
            if (e.getMessage() != null && e.getMessage().contains("phone")) {
                throw new IllegalArgumentException("This phone number is already registered with another account.");
            }
            throw e;
        }

        if (request.getMonthlyExpenses() != null && !request.getMonthlyExpenses().isEmpty()) {
            financialProfileService.saveExpenses(user.getId(), request.getMonthlyExpenses());
        }

        // Issue OTP and send verification email
        sendVerificationCode(user, email);

        return new MessageResponse("Verification email sent. Please check your inbox.");
    }

    // ── Email verification ─────────────────────────────────────────────────────

    /**
     * Validates the 6-digit OTP, marks the user as verified, and returns a JWT.
     */
    @Transactional
    public AuthResponse verifyEmail(VerifyEmailRequest request) {
        String email = request.getEmail().trim().toLowerCase();

        EmailVerificationToken token = tokenRepository
                .findActiveToken(email, TokenPurpose.EMAIL_VERIFICATION)
                .orElseThrow(() -> new InvalidTokenException("Invalid or expired verification code."));

        if (!token.getCode().equals(request.getCode())) {
            throw new InvalidTokenException("Invalid or expired verification code.");
        }

        // Mark token used
        token.setUsed(true);
        tokenRepository.save(token);

        // Mark user verified
        User user = token.getUser();
        user.setEmailVerified(true);
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);

        return AuthResponse.builder()
                .token(jwtUtil.generateToken(user.getEmail()))
                .email(user.getEmail())
                .fullName(user.getFullName())
                .userId(user.getId())
                .phone(user.getPhone())
                .build();
    }

    /**
     * Resends a verification code, invalidating any previous active codes first.
     */
    @Transactional
    public MessageResponse resendVerification(ResendCodeRequest request) {
        String email = request.getEmail().trim().toLowerCase();

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new InvalidCredentialsException("Invalid email or password."));

        if (user.isEmailVerified()) {
            return new MessageResponse("Email is already verified.");
        }

        sendVerificationCode(user, email);
        return new MessageResponse("Verification email sent. Please check your inbox.");
    }

    // ── Login ─────────────────────────────────────────────────────────────────

    public AuthResponse login(LoginRequest request) {
        String email = request.getEmail().trim().toLowerCase();

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new InvalidCredentialsException("Invalid email or password."));

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new InvalidCredentialsException("Invalid email or password.");
        }

        // Block login until email is verified
        if (!user.isEmailVerified()) {
            throw new EmailNotVerifiedException("Please verify your email address before logging in.");
        }

        return AuthResponse.builder()
                .token(jwtUtil.generateToken(user.getEmail()))
                .email(user.getEmail())
                .fullName(user.getFullName())
                .userId(user.getId())
                .phone(user.getPhone())
                .build();
    }

    // ── Password reset ─────────────────────────────────────────────────────────

    /**
     * Step 1: sends a reset code to the email.
     * Always returns 200 — never reveals whether the email exists.
     */
    @Transactional
    public MessageResponse forgotPassword(ForgotPasswordRequest request) {
        String email = request.getEmail().trim().toLowerCase();

        // Look up silently — don't leak whether the email exists
        userRepository.findByEmail(email).ifPresent(user ->
                sendPasswordResetCode(user, email)
        );

        return new MessageResponse("If that email is registered, a reset code has been sent.");
    }

    /**
     * Step 2: validates the OTP and exchanges it for a short-lived resetToken UUID.
     */
    @Transactional
    public ResetTokenResponse verifyResetCode(VerifyResetCodeRequest request) {
        String email = request.getEmail().trim().toLowerCase();

        EmailVerificationToken token = tokenRepository
                .findActiveToken(email, TokenPurpose.PASSWORD_RESET)
                .orElseThrow(() -> new InvalidTokenException("Invalid or expired reset code."));

        if (!token.getCode().equals(request.getCode())) {
            throw new InvalidTokenException("Invalid or expired reset code.");
        }

        // Generate a one-use reset token (10 minute TTL from now)
        String resetToken = UUID.randomUUID().toString();
        token.setResetToken(resetToken);
        token.setExpiresAt(LocalDateTime.now().plusMinutes(10));  // shorten window after OTP verified
        tokenRepository.save(token);

        return new ResetTokenResponse(resetToken);
    }

    /**
     * Step 3: validates the resetToken and sets the new password.
     */
    @Transactional
    public MessageResponse resetPassword(ResetPasswordRequest request) {
        EmailVerificationToken token = tokenRepository
                .findActiveResetToken(request.getResetToken())
                .orElseThrow(() -> new InvalidTokenException("Invalid or expired reset token. Please start over."));

        // Mark used immediately (single-use)
        token.setUsed(true);
        tokenRepository.save(token);

        User user = token.getUser();
        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);

        return new MessageResponse("Password updated successfully.");
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private void sendVerificationCode(User user, String email) {
        // Invalidate any previous unused codes for this email + purpose
        tokenRepository.invalidateAll(email, TokenPurpose.EMAIL_VERIFICATION);

        String code = generateOtp();
        EmailVerificationToken token = EmailVerificationToken.builder()
                .email(email)
                .user(user)
                .code(code)
                .purpose(TokenPurpose.EMAIL_VERIFICATION)
                .expiresAt(LocalDateTime.now().plusMinutes(15))
                .used(false)
                .createdAt(LocalDateTime.now())
                .build();
        tokenRepository.save(token);

        // Send asynchronously — does not block the HTTP response
        emailService.sendVerificationEmail(email, user.getFullName(), code);
    }

    private void sendPasswordResetCode(User user, String email) {
        tokenRepository.invalidateAll(email, TokenPurpose.PASSWORD_RESET);

        String code = generateOtp();
        EmailVerificationToken token = EmailVerificationToken.builder()
                .email(email)
                .user(user)
                .code(code)
                .purpose(TokenPurpose.PASSWORD_RESET)
                .expiresAt(LocalDateTime.now().plusMinutes(15))
                .used(false)
                .createdAt(LocalDateTime.now())
                .build();
        tokenRepository.save(token);

        emailService.sendPasswordResetEmail(email, user.getFullName(), code);
    }
}