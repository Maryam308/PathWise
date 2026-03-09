package com.pathwise.backend.service;

import com.pathwise.backend.config.TestDataFactory;
import com.pathwise.backend.dto.*;
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
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock private UserRepository                   userRepository;
    @Mock private EmailVerificationTokenRepository tokenRepository;
    @Mock private PasswordEncoder                  passwordEncoder;
    @Mock private JwtUtil                          jwtUtil;
    @Mock private FinancialProfileService          financialProfileService;
    @Mock private EmailService                     emailService;

    @InjectMocks
    private AuthService authService;

    private User testUser;
    private RegisterRequest validRegisterRequest;
    private EmailVerificationToken activeVerificationToken;
    private EmailVerificationToken activeResetToken;

    @BeforeEach
    void setUp() {
        testUser = TestDataFactory.createTestUser();
        validRegisterRequest = TestDataFactory.createValidRegisterRequest();

        activeVerificationToken = EmailVerificationToken.builder()
                .id(UUID.randomUUID())
                .email("test@example.com")
                .user(testUser)
                .code("123456")
                .purpose(TokenPurpose.EMAIL_VERIFICATION)
                .expiresAt(LocalDateTime.now().plusMinutes(15))
                .used(false)
                .createdAt(LocalDateTime.now())
                .build();

        activeResetToken = EmailVerificationToken.builder()
                .id(UUID.randomUUID())
                .email("test@example.com")
                .user(testUser)
                .code("654321")
                .resetToken("some-uuid-reset-token")
                .purpose(TokenPurpose.PASSWORD_RESET)
                .expiresAt(LocalDateTime.now().plusMinutes(15))
                .used(false)
                .createdAt(LocalDateTime.now())
                .build();
    }

    // ── register ──────────────────────────────────────────────────────────────

    @Test
    void register_WithValidData_ReturnsMessageAndSendsEmail() {
        when(userRepository.existsByEmail(anyString())).thenReturn(false);
        when(userRepository.existsByPhone(anyString())).thenReturn(false);
        when(passwordEncoder.encode(anyString())).thenReturn("hashedPassword");
        when(userRepository.save(any(User.class))).thenReturn(testUser);
        when(tokenRepository.save(any(EmailVerificationToken.class)))
                .thenReturn(activeVerificationToken);

        MessageResponse response = authService.register(validRegisterRequest);

        assertEquals("Verification email sent. Please check your inbox.", response.getMessage());
        verify(emailService).sendVerificationEmail(anyString(), anyString(), anyString());
        verify(userRepository, never()).existsByEmail(""); // not a blank email check
    }

    @Test
    void register_NormalizesEmailToLowercase() {
        validRegisterRequest.setEmail("TEST@EXAMPLE.COM");

        when(userRepository.existsByEmail("test@example.com")).thenReturn(false);
        when(userRepository.existsByPhone(anyString())).thenReturn(false);
        when(passwordEncoder.encode(anyString())).thenReturn("hashed");
        when(userRepository.save(any(User.class))).thenReturn(testUser);
        when(tokenRepository.save(any(EmailVerificationToken.class)))
                .thenReturn(activeVerificationToken);

        authService.register(validRegisterRequest);

        verify(userRepository).existsByEmail("test@example.com");
    }

    @Test
    void register_WithExistingEmail_ThrowsEmailAlreadyExistsException() {
        when(userRepository.existsByEmail(anyString())).thenReturn(true);

        assertThrows(EmailAlreadyExistsException.class,
                () -> authService.register(validRegisterRequest));

        verify(userRepository, never()).save(any());
        verify(emailService, never()).sendVerificationEmail(any(), any(), any());
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
    void register_CreatesUserWithEmailVerifiedFalse() {
        when(userRepository.existsByEmail(anyString())).thenReturn(false);
        when(userRepository.existsByPhone(anyString())).thenReturn(false);
        when(passwordEncoder.encode(anyString())).thenReturn("hashed");
        when(tokenRepository.save(any())).thenReturn(activeVerificationToken);

        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User saved = inv.getArgument(0);
            assertFalse(saved.isEmailVerified(), "New users must not be verified on registration");
            return testUser;
        });

        authService.register(validRegisterRequest);
    }

    @Test
    void register_InvalidatesOldTokensBeforeIssuingNew() {
        when(userRepository.existsByEmail(anyString())).thenReturn(false);
        when(userRepository.existsByPhone(anyString())).thenReturn(false);
        when(passwordEncoder.encode(anyString())).thenReturn("hashed");
        when(userRepository.save(any(User.class))).thenReturn(testUser);
        when(tokenRepository.save(any())).thenReturn(activeVerificationToken);

        authService.register(validRegisterRequest);

        verify(tokenRepository).invalidateAll(anyString(), eq(TokenPurpose.EMAIL_VERIFICATION));
    }

    // ── verifyEmail ───────────────────────────────────────────────────────────

    @Test
    void verifyEmail_WithValidCode_ReturnsJwtAndMarksVerified() {
        when(tokenRepository.findActiveToken("test@example.com", TokenPurpose.EMAIL_VERIFICATION))
                .thenReturn(Optional.of(activeVerificationToken));
        when(userRepository.save(any(User.class))).thenReturn(testUser);
        when(tokenRepository.save(any())).thenReturn(activeVerificationToken);
        when(jwtUtil.generateToken("test@example.com")).thenReturn("test-jwt-token");

        VerifyEmailRequest request = new VerifyEmailRequest();
        request.setEmail("test@example.com");
        request.setCode("123456");

        AuthResponse response = authService.verifyEmail(request);

        assertEquals("test-jwt-token", response.getToken());
        assertEquals("test@example.com", response.getEmail());

        // user must be marked verified
        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(userCaptor.capture());
        assertTrue(userCaptor.getValue().isEmailVerified());

        // token must be marked used
        ArgumentCaptor<EmailVerificationToken> tokenCaptor =
                ArgumentCaptor.forClass(EmailVerificationToken.class);
        verify(tokenRepository).save(tokenCaptor.capture());
        assertTrue(tokenCaptor.getValue().isUsed());
    }

    @Test
    void verifyEmail_WithWrongCode_ThrowsInvalidTokenException() {
        when(tokenRepository.findActiveToken("test@example.com", TokenPurpose.EMAIL_VERIFICATION))
                .thenReturn(Optional.of(activeVerificationToken));

        VerifyEmailRequest request = new VerifyEmailRequest();
        request.setEmail("test@example.com");
        request.setCode("000000"); // wrong

        assertThrows(InvalidTokenException.class, () -> authService.verifyEmail(request));
        verify(userRepository, never()).save(any());
    }

    @Test
    void verifyEmail_WithNoActiveToken_ThrowsInvalidTokenException() {
        when(tokenRepository.findActiveToken(anyString(), any()))
                .thenReturn(Optional.empty());

        VerifyEmailRequest request = new VerifyEmailRequest();
        request.setEmail("test@example.com");
        request.setCode("123456");

        assertThrows(InvalidTokenException.class, () -> authService.verifyEmail(request));
    }

    // ── resendVerification ────────────────────────────────────────────────────

    @Test
    void resendVerification_WithUnverifiedUser_SendsNewCode() {
        testUser.setEmailVerified(false);
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(tokenRepository.save(any())).thenReturn(activeVerificationToken);

        ResendCodeRequest request = new ResendCodeRequest();
        request.setEmail("test@example.com");

        MessageResponse response = authService.resendVerification(request);

        assertEquals("Verification email sent. Please check your inbox.", response.getMessage());
        verify(emailService).sendVerificationEmail(anyString(), anyString(), anyString());
    }

    @Test
    void resendVerification_WithAlreadyVerifiedUser_ReturnsAlreadyVerifiedMessage() {
        testUser.setEmailVerified(true);
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));

        ResendCodeRequest request = new ResendCodeRequest();
        request.setEmail("test@example.com");

        MessageResponse response = authService.resendVerification(request);

        assertEquals("Email is already verified.", response.getMessage());
        verify(emailService, never()).sendVerificationEmail(any(), any(), any());
    }

    @Test
    void resendVerification_WithUnknownEmail_ThrowsInvalidCredentialsException() {
        when(userRepository.findByEmail(anyString())).thenReturn(Optional.empty());

        ResendCodeRequest request = new ResendCodeRequest();
        request.setEmail("nobody@example.com");

        assertThrows(InvalidCredentialsException.class,
                () -> authService.resendVerification(request));
    }

    // ── login ─────────────────────────────────────────────────────────────────

    @Test
    void login_WithValidCredentials_ReturnsAuthResponse() {
        testUser.setEmailVerified(true);
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(passwordEncoder.matches("password", testUser.getPasswordHash())).thenReturn(true);
        when(jwtUtil.generateToken("test@example.com")).thenReturn("test-jwt-token");

        LoginRequest request = TestDataFactory.createValidLoginRequest();
        AuthResponse response = authService.login(request);

        assertEquals("test-jwt-token", response.getToken());
        assertEquals("test@example.com", response.getEmail());
    }

    @Test
    void login_WithWrongPassword_ThrowsInvalidCredentialsException() {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(passwordEncoder.matches(anyString(), anyString())).thenReturn(false);

        assertThrows(InvalidCredentialsException.class,
                () -> authService.login(TestDataFactory.createValidLoginRequest()));
    }

    @Test
    void login_WithNonExistentEmail_ThrowsInvalidCredentialsException() {
        when(userRepository.findByEmail(anyString())).thenReturn(Optional.empty());

        assertThrows(InvalidCredentialsException.class,
                () -> authService.login(TestDataFactory.createValidLoginRequest()));
    }

    @Test
    void login_WithUnverifiedEmail_ThrowsEmailNotVerifiedException() {
        testUser.setEmailVerified(false);
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(passwordEncoder.matches(anyString(), anyString())).thenReturn(true);

        assertThrows(EmailNotVerifiedException.class,
                () -> authService.login(TestDataFactory.createValidLoginRequest()));
    }

    // ── forgotPassword ────────────────────────────────────────────────────────

    @Test
    void forgotPassword_WithKnownEmail_SendsResetCodeAndReturns200() {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(tokenRepository.save(any())).thenReturn(activeResetToken);

        ForgotPasswordRequest request = new ForgotPasswordRequest();
        request.setEmail("test@example.com");

        MessageResponse response = authService.forgotPassword(request);

        assertNotNull(response.getMessage());
        verify(emailService).sendPasswordResetEmail(anyString(), anyString(), anyString());
    }

    @Test
    void forgotPassword_WithUnknownEmail_ReturnsOkWithoutSendingEmail() {
        // Security: must NOT reveal whether email exists
        when(userRepository.findByEmail(anyString())).thenReturn(Optional.empty());

        ForgotPasswordRequest request = new ForgotPasswordRequest();
        request.setEmail("nobody@example.com");

        MessageResponse response = authService.forgotPassword(request);

        assertNotNull(response.getMessage()); // still returns a message
        verify(emailService, never()).sendPasswordResetEmail(any(), any(), any());
    }

    // ── verifyResetCode ───────────────────────────────────────────────────────

    @Test
    void verifyResetCode_WithValidCode_ReturnsResetToken() {
        when(tokenRepository.findActiveToken("test@example.com", TokenPurpose.PASSWORD_RESET))
                .thenReturn(Optional.of(activeResetToken));
        when(tokenRepository.save(any())).thenReturn(activeResetToken);

        VerifyResetCodeRequest request = new VerifyResetCodeRequest();
        request.setEmail("test@example.com");
        request.setCode("654321");

        ResetTokenResponse response = authService.verifyResetCode(request);

        // A UUID-style reset token is set on the saved entity
        ArgumentCaptor<EmailVerificationToken> captor =
                ArgumentCaptor.forClass(EmailVerificationToken.class);
        verify(tokenRepository).save(captor.capture());
        assertNotNull(captor.getValue().getResetToken());
    }

    @Test
    void verifyResetCode_WithWrongCode_ThrowsInvalidTokenException() {
        when(tokenRepository.findActiveToken("test@example.com", TokenPurpose.PASSWORD_RESET))
                .thenReturn(Optional.of(activeResetToken));

        VerifyResetCodeRequest request = new VerifyResetCodeRequest();
        request.setEmail("test@example.com");
        request.setCode("000000");

        assertThrows(InvalidTokenException.class, () -> authService.verifyResetCode(request));
    }

    // ── resetPassword ─────────────────────────────────────────────────────────

    @Test
    void resetPassword_WithValidToken_UpdatesPasswordAndMarksTokenUsed() {
        when(tokenRepository.findActiveResetToken("some-uuid-reset-token"))
                .thenReturn(Optional.of(activeResetToken));
        when(passwordEncoder.encode("newPassword123")).thenReturn("hashedNewPassword");
        when(tokenRepository.save(any())).thenReturn(activeResetToken);
        when(userRepository.save(any(User.class))).thenReturn(testUser);

        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setResetToken("some-uuid-reset-token");
        request.setNewPassword("newPassword123");

        MessageResponse response = authService.resetPassword(request);

        assertEquals("Password updated successfully.", response.getMessage());

        // token must be marked used
        ArgumentCaptor<EmailVerificationToken> tokenCaptor =
                ArgumentCaptor.forClass(EmailVerificationToken.class);
        verify(tokenRepository).save(tokenCaptor.capture());
        assertTrue(tokenCaptor.getValue().isUsed());

        // password must be updated
        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(userCaptor.capture());
        assertEquals("hashedNewPassword", userCaptor.getValue().getPasswordHash());
    }

    @Test
    void resetPassword_WithInvalidToken_ThrowsInvalidTokenException() {
        when(tokenRepository.findActiveResetToken(anyString())).thenReturn(Optional.empty());

        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setResetToken("expired-token");
        request.setNewPassword("newPassword123");

        assertThrows(InvalidTokenException.class, () -> authService.resetPassword(request));
        verify(userRepository, never()).save(any());
    }
}