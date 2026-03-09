package com.pathwise.backend.service;

import com.pathwise.backend.config.TestDataFactory;
import com.pathwise.backend.dto.*;
import com.pathwise.backend.enums.ExpenseCategory;
import com.pathwise.backend.enums.TokenPurpose;
import com.pathwise.backend.exception.*;
import com.pathwise.backend.model.EmailVerificationToken;
import com.pathwise.backend.model.User;
import com.pathwise.backend.repository.EmailVerificationTokenRepository;
import com.pathwise.backend.repository.UserRepository;
import com.pathwise.backend.security.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for AuthService — covers the full auth lifecycle:
 * register → verifyEmail → login, plus forgot-password flow.
 *
 * Note: the uploaded AuthService.java is the OLD version (no email verification).
 * These tests are written against the NEW AuthService (with OTP verification)
 * that was delivered in the previous session. Replace AuthService.java with
 * the new version before running.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AuthServiceTest {

    @Mock private UserRepository                  userRepository;
    @Mock private EmailVerificationTokenRepository tokenRepository;
    @Mock private PasswordEncoder                 passwordEncoder;
    @Mock private JwtUtil                         jwtUtil;
    @Mock private FinancialProfileService         financialProfileService;
    @Mock private EmailService                    emailService;

    @InjectMocks
    private AuthService authService;

    private RegisterRequest validRegisterRequest;
    private User            verifiedUser;
    private User            unverifiedUser;

    @BeforeEach
    void setUp() {
        validRegisterRequest = TestDataFactory.createValidRegisterRequest();

        verifiedUser = TestDataFactory.createTestUser();   // emailVerified = true

        unverifiedUser = User.builder()
                .id(UUID.randomUUID())
                .fullName("Unverified User")
                .email("unverified@example.com")
                .passwordHash("hash")
                .phone("33445566")
                .monthlySalary(new BigDecimal("2000.000"))
                .emailVerified(false)
                .build();
    }

    // ── register() ────────────────────────────────────────────────────────────

    @Test
    void register_WithValidData_ReturnsMessageResponse() {
        when(userRepository.existsByEmail(anyString())).thenReturn(false);
        when(userRepository.existsByPhone(anyString())).thenReturn(false);
        when(passwordEncoder.encode(anyString())).thenReturn("hashedPw");
        when(userRepository.save(any(User.class))).thenReturn(verifiedUser);

        MessageResponse result = authService.register(validRegisterRequest);

        assertNotNull(result);
        assertNotNull(result.getMessage());
        // OTP email should be sent
        verify(emailService).sendVerificationEmail(anyString(), anyString(), anyString());
    }

    @Test
    void register_WithExistingEmail_ThrowsEmailAlreadyExistsException() {
        when(userRepository.existsByEmail(anyString())).thenReturn(true);

        assertThrows(EmailAlreadyExistsException.class,
                () -> authService.register(validRegisterRequest));

        verify(userRepository, never()).save(any());
    }

    @Test
    void register_WithExistingPhone_ThrowsIllegalArgumentException() {
        when(userRepository.existsByEmail(anyString())).thenReturn(false);
        when(userRepository.existsByPhone(anyString())).thenReturn(true);

        assertThrows(IllegalArgumentException.class,
                () -> authService.register(validRegisterRequest));

        verify(userRepository, never()).save(any());
    }

    @Test
    void register_NormalisesEmailToLowercase() {
        validRegisterRequest.setEmail("  USER@Example.COM  ");
        when(userRepository.existsByEmail("user@example.com")).thenReturn(false);
        when(userRepository.existsByPhone(anyString())).thenReturn(false);
        when(passwordEncoder.encode(anyString())).thenReturn("hashedPw");
        when(userRepository.save(any(User.class))).thenReturn(verifiedUser);

        authService.register(validRegisterRequest);

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        assertEquals("user@example.com", captor.getValue().getEmail());
    }

    @Test
    void register_WithExpensesExceedingSalary_ThrowsInvalidExpenseDataException() {
        RegisterRequest.ExpenseItem bigExpense = new RegisterRequest.ExpenseItem();
        bigExpense.setCategory(ExpenseCategory.HOUSING);
        bigExpense.setAmount(new BigDecimal("9999.000")); // more than salary
        bigExpense.setLabel("Mansion");
        validRegisterRequest.setMonthlyExpenses(List.of(bigExpense));

        when(userRepository.existsByEmail(anyString())).thenReturn(false);
        when(userRepository.existsByPhone(anyString())).thenReturn(false);

        assertThrows(InvalidExpenseDataException.class,
                () -> authService.register(validRegisterRequest));
    }

    @Test
    void register_WithDuplicateExpenseCategories_ThrowsInvalidExpenseDataException() {
        RegisterRequest.ExpenseItem rent1 = new RegisterRequest.ExpenseItem();
        rent1.setCategory(ExpenseCategory.HOUSING);
        rent1.setAmount(new BigDecimal("200.000"));
        rent1.setLabel("Rent");

        RegisterRequest.ExpenseItem rent2 = new RegisterRequest.ExpenseItem();
        rent2.setCategory(ExpenseCategory.HOUSING); // duplicate
        rent2.setAmount(new BigDecimal("100.000"));
        rent2.setLabel("Garage");

        validRegisterRequest.setMonthlyExpenses(List.of(rent1, rent2));

        when(userRepository.existsByEmail(anyString())).thenReturn(false);
        when(userRepository.existsByPhone(anyString())).thenReturn(false);

        assertThrows(InvalidExpenseDataException.class,
                () -> authService.register(validRegisterRequest));
    }

    // ── verifyEmail() ─────────────────────────────────────────────────────────

    @Test
    void verifyEmail_WithValidCode_ReturnsAuthResponseWithToken() {
        EmailVerificationToken token = EmailVerificationToken.builder()
                .id(UUID.randomUUID())
                .email(unverifiedUser.getEmail())
                .user(unverifiedUser)
                .code("123456")
                .purpose(TokenPurpose.EMAIL_VERIFICATION)
                .expiresAt(LocalDateTime.now().plusMinutes(10))
                .used(false)
                .build();

        VerifyEmailRequest request = new VerifyEmailRequest();
        request.setEmail(unverifiedUser.getEmail());
        request.setCode("123456");

        when(tokenRepository.findActiveToken(anyString(), eq(TokenPurpose.EMAIL_VERIFICATION)))
                .thenReturn(Optional.of(token));
        when(userRepository.save(any(User.class))).thenReturn(verifiedUser);
        when(jwtUtil.generateToken(anyString())).thenReturn("new-jwt-token");

        AuthResponse result = authService.verifyEmail(request);

        assertNotNull(result);
        assertEquals("new-jwt-token", result.getToken());
        assertTrue(token.isUsed()); // token marked as used
    }

    @Test
    void verifyEmail_WithWrongCode_ThrowsInvalidTokenException() {
        EmailVerificationToken token = EmailVerificationToken.builder()
                .id(UUID.randomUUID())
                .email(unverifiedUser.getEmail())
                .user(unverifiedUser)
                .code("999999")
                .purpose(TokenPurpose.EMAIL_VERIFICATION)
                .expiresAt(LocalDateTime.now().plusMinutes(10))
                .used(false)
                .build();

        VerifyEmailRequest request = new VerifyEmailRequest();
        request.setEmail(unverifiedUser.getEmail());
        request.setCode("123456"); // wrong code

        when(tokenRepository.findActiveToken(anyString(), eq(TokenPurpose.EMAIL_VERIFICATION)))
                .thenReturn(Optional.of(token));

        assertThrows(InvalidTokenException.class,
                () -> authService.verifyEmail(request));
    }

    @Test
    void verifyEmail_WithExpiredToken_ThrowsInvalidTokenException() {
        when(tokenRepository.findActiveToken(anyString(), eq(TokenPurpose.EMAIL_VERIFICATION)))
                .thenReturn(Optional.empty()); // no active token found

        VerifyEmailRequest request = new VerifyEmailRequest();
        request.setEmail(unverifiedUser.getEmail());
        request.setCode("123456");

        assertThrows(InvalidTokenException.class,
                () -> authService.verifyEmail(request));
    }

    // ── login() ───────────────────────────────────────────────────────────────

    @Test
    void login_WithVerifiedUser_ReturnsAuthResponse() {
        when(userRepository.findByEmail(anyString())).thenReturn(Optional.of(verifiedUser));
        when(passwordEncoder.matches(anyString(), anyString())).thenReturn(true);
        when(jwtUtil.generateToken(anyString())).thenReturn("jwt-token");

        LoginRequest request = TestDataFactory.createValidLoginRequest();
        AuthResponse result = authService.login(request);

        assertNotNull(result);
        assertEquals("jwt-token", result.getToken());
        assertEquals(verifiedUser.getEmail(), result.getEmail());
    }

    @Test
    void login_WithUnverifiedEmail_ThrowsEmailNotVerifiedException() {
        when(userRepository.findByEmail(anyString())).thenReturn(Optional.of(unverifiedUser));
        when(passwordEncoder.matches(anyString(), anyString())).thenReturn(true);

        LoginRequest request = new LoginRequest();
        request.setEmail(unverifiedUser.getEmail());
        request.setPassword("password");

        assertThrows(EmailNotVerifiedException.class,
                () -> authService.login(request));
    }

    @Test
    void login_WithWrongPassword_ThrowsInvalidCredentialsException() {
        when(userRepository.findByEmail(anyString())).thenReturn(Optional.of(verifiedUser));
        when(passwordEncoder.matches(anyString(), anyString())).thenReturn(false);

        LoginRequest request = TestDataFactory.createValidLoginRequest();

        assertThrows(InvalidCredentialsException.class,
                () -> authService.login(request));
    }

    @Test
    void login_WithUnknownEmail_ThrowsInvalidCredentialsException() {
        when(userRepository.findByEmail(anyString())).thenReturn(Optional.empty());

        LoginRequest request = TestDataFactory.createValidLoginRequest();

        assertThrows(InvalidCredentialsException.class,
                () -> authService.login(request));
    }

    @Test
    void login_NormalisesEmailToLowercase() {
        LoginRequest request = new LoginRequest();
        request.setEmail("  TEST@EXAMPLE.COM  ");
        request.setPassword("password");

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(verifiedUser));
        when(passwordEncoder.matches(anyString(), anyString())).thenReturn(true);
        when(jwtUtil.generateToken(anyString())).thenReturn("token");

        AuthResponse result = authService.login(request);
        assertNotNull(result);
        verify(userRepository).findByEmail("test@example.com");
    }

    // ── forgotPassword() ──────────────────────────────────────────────────────

    @Test
    void forgotPassword_AlwaysReturnsMessage_EvenForUnknownEmail() {
        when(userRepository.findByEmail(anyString())).thenReturn(Optional.empty());

        ForgotPasswordRequest request = new ForgotPasswordRequest();
        request.setEmail("nobody@example.com");

        // Must NOT throw — security: no email enumeration
        MessageResponse result = assertDoesNotThrow(
                () -> authService.forgotPassword(request));

        assertNotNull(result);
        assertNotNull(result.getMessage());
    }

    @Test
    void forgotPassword_ForKnownEmail_SendsResetEmail() {
        when(userRepository.findByEmail(anyString())).thenReturn(Optional.of(verifiedUser));

        ForgotPasswordRequest request = new ForgotPasswordRequest();
        request.setEmail(verifiedUser.getEmail());

        authService.forgotPassword(request);

        verify(emailService).sendPasswordResetEmail(
                eq(verifiedUser.getEmail()), anyString(), anyString());
    }

    // ── resetPassword() ───────────────────────────────────────────────────────

    @Test
    void resetPassword_WithValidToken_UpdatesPasswordAndReturnsMessage() {
        EmailVerificationToken resetToken = EmailVerificationToken.builder()
                .id(UUID.randomUUID())
                .email(verifiedUser.getEmail())
                .user(verifiedUser)
                .code("000000")
                .purpose(TokenPurpose.PASSWORD_RESET)
                .resetToken("valid-reset-token")
                .expiresAt(LocalDateTime.now().plusMinutes(10))
                .used(false)
                .build();

        when(tokenRepository.findActiveResetToken("valid-reset-token"))
                .thenReturn(Optional.of(resetToken));
        when(passwordEncoder.encode(anyString())).thenReturn("newHashedPw");
        when(userRepository.save(any(User.class))).thenReturn(verifiedUser);

        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setResetToken("valid-reset-token");
        request.setNewPassword("newPassword123");

        MessageResponse result = authService.resetPassword(request);

        assertNotNull(result);
        assertTrue(resetToken.isUsed());
        verify(passwordEncoder).encode("newPassword123");
        verify(userRepository).save(verifiedUser);
    }

    @Test
    void resetPassword_WithExpiredToken_ThrowsInvalidTokenException() {
        when(tokenRepository.findActiveResetToken(anyString())).thenReturn(Optional.empty());

        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setResetToken("expired-token");
        request.setNewPassword("newPassword123");

        assertThrows(InvalidTokenException.class,
                () -> authService.resetPassword(request));
    }
}