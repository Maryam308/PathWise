package com.pathwise.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pathwise.backend.config.TestDataFactory;
import com.pathwise.backend.config.TestSecurityConfig;
import com.pathwise.backend.config.TestJwtConfig;
import com.pathwise.backend.dto.*;
import com.pathwise.backend.exception.*;
import com.pathwise.backend.service.AuthService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AuthController.class)
@Import({TestSecurityConfig.class, TestDataFactory.class, TestJwtConfig.class})
@ActiveProfiles("test")
class AuthControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @MockitoBean private AuthService authService;

    private RegisterRequest validRegisterRequest;
    private LoginRequest validLoginRequest;
    private AuthResponse authResponse;
    private MessageResponse messageResponse;

    @BeforeEach
    void setUp() {
        validRegisterRequest = TestDataFactory.createValidRegisterRequest();
        validLoginRequest    = TestDataFactory.createValidLoginRequest();
        authResponse         = TestDataFactory.createAuthResponse();
        messageResponse      = new MessageResponse("Verification email sent. Please check your inbox.");
    }

    // ── POST /api/auth/register ───────────────────────────────────────────────

    @Test
    void register_WithValidData_ReturnsCreated() throws Exception {
        when(authService.register(any(RegisterRequest.class))).thenReturn(messageResponse);

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validRegisterRequest)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.message").value("Verification email sent. Please check your inbox."));
    }

    @Test
    void register_WithExistingEmail_ReturnsConflict() throws Exception {
        when(authService.register(any(RegisterRequest.class)))
                .thenThrow(new EmailAlreadyExistsException("Email already exists"));

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validRegisterRequest)))
                .andExpect(status().isConflict());
    }

    @Test
    void register_WithInvalidEmail_ReturnsBadRequest() throws Exception {
        validRegisterRequest.setEmail("invalid-email");

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validRegisterRequest)))
                .andExpect(status().isBadRequest());
    }

    // ── POST /api/auth/verify-email ───────────────────────────────────────────

    @Test
    void verifyEmail_WithValidCode_ReturnsOkWithToken() throws Exception {
        when(authService.verifyEmail(any(VerifyEmailRequest.class))).thenReturn(authResponse);

        VerifyEmailRequest request = new VerifyEmailRequest();
        request.setEmail("test@example.com");
        request.setCode("123456");

        mockMvc.perform(post("/api/auth/verify-email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("test-jwt-token"))
                .andExpect(jsonPath("$.email").value("test@example.com"));
    }

    @Test
    void verifyEmail_WithInvalidCode_ReturnsBadRequest() throws Exception {
        when(authService.verifyEmail(any(VerifyEmailRequest.class)))
                .thenThrow(new InvalidTokenException("Invalid or expired verification code."));

        VerifyEmailRequest request = new VerifyEmailRequest();
        request.setEmail("test@example.com");
        request.setCode("000000");

        mockMvc.perform(post("/api/auth/verify-email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void verifyEmail_WithNonSixDigitCode_ReturnsBadRequest() throws Exception {
        VerifyEmailRequest request = new VerifyEmailRequest();
        request.setEmail("test@example.com");
        request.setCode("12");   // fails @Pattern(regexp = "^[0-9]{6}$")

        mockMvc.perform(post("/api/auth/verify-email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    // ── POST /api/auth/resend-verification ────────────────────────────────────

    @Test
    void resendVerification_WithValidEmail_ReturnsOk() throws Exception {
        when(authService.resendVerification(any(ResendCodeRequest.class)))
                .thenReturn(new MessageResponse("Verification email sent. Please check your inbox."));

        ResendCodeRequest request = new ResendCodeRequest();
        request.setEmail("test@example.com");

        mockMvc.perform(post("/api/auth/resend-verification")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").exists());
    }

    // ── POST /api/auth/login ──────────────────────────────────────────────────

    @Test
    void login_WithValidCredentials_ReturnsOk() throws Exception {
        when(authService.login(any(LoginRequest.class))).thenReturn(authResponse);

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validLoginRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("test-jwt-token"));
    }

    @Test
    void login_WithInvalidCredentials_ReturnsUnauthorized() throws Exception {
        when(authService.login(any(LoginRequest.class)))
                .thenThrow(new InvalidCredentialsException("Invalid credentials"));

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validLoginRequest)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void login_WithUnverifiedEmail_ReturnsForbiddenWithErrorCode() throws Exception {
        when(authService.login(any(LoginRequest.class)))
                .thenThrow(new EmailNotVerifiedException("Please verify your email address before logging in."));

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validLoginRequest)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("EMAIL_NOT_VERIFIED"));
    }

    // ── POST /api/auth/forgot-password ────────────────────────────────────────

    @Test
    void forgotPassword_AlwaysReturnsOk() throws Exception {
        when(authService.forgotPassword(any(ForgotPasswordRequest.class)))
                .thenReturn(new MessageResponse("If that email is registered, a reset code has been sent."));

        ForgotPasswordRequest request = new ForgotPasswordRequest();
        request.setEmail("anyone@example.com");

        mockMvc.perform(post("/api/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").exists());
    }

    @Test
    void forgotPassword_WithInvalidEmail_ReturnsBadRequest() throws Exception {
        ForgotPasswordRequest request = new ForgotPasswordRequest();
        request.setEmail("not-an-email");

        mockMvc.perform(post("/api/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    // ── POST /api/auth/verify-reset-code ──────────────────────────────────────

    @Test
    void verifyResetCode_WithValidCode_ReturnsResetToken() throws Exception {
        when(authService.verifyResetCode(any(VerifyResetCodeRequest.class)))
                .thenReturn(new ResetTokenResponse("some-uuid-reset-token"));

        VerifyResetCodeRequest request = new VerifyResetCodeRequest();
        request.setEmail("test@example.com");
        request.setCode("654321");

        mockMvc.perform(post("/api/auth/verify-reset-code")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.resetToken").value("some-uuid-reset-token"));
    }

    @Test
    void verifyResetCode_WithExpiredCode_ReturnsBadRequest() throws Exception {
        when(authService.verifyResetCode(any(VerifyResetCodeRequest.class)))
                .thenThrow(new InvalidTokenException("Invalid or expired reset code."));

        VerifyResetCodeRequest request = new VerifyResetCodeRequest();
        request.setEmail("test@example.com");
        request.setCode("000000");

        mockMvc.perform(post("/api/auth/verify-reset-code")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    // ── POST /api/auth/reset-password ─────────────────────────────────────────

    @Test
    void resetPassword_WithValidToken_ReturnsOk() throws Exception {
        when(authService.resetPassword(any(ResetPasswordRequest.class)))
                .thenReturn(new MessageResponse("Password updated successfully."));

        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setResetToken("some-uuid-reset-token");
        request.setNewPassword("newPassword123");

        mockMvc.perform(post("/api/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Password updated successfully."));
    }

    @Test
    void resetPassword_WithInvalidToken_ReturnsBadRequest() throws Exception {
        when(authService.resetPassword(any(ResetPasswordRequest.class)))
                .thenThrow(new InvalidTokenException("Invalid or expired reset token. Please start over."));

        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setResetToken("expired-token");
        request.setNewPassword("newPassword123");

        mockMvc.perform(post("/api/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void resetPassword_WithShortPassword_ReturnsBadRequest() throws Exception {
        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setResetToken("some-uuid-reset-token");
        request.setNewPassword("abc");   // fails @Size(min = 6)

        mockMvc.perform(post("/api/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }
}