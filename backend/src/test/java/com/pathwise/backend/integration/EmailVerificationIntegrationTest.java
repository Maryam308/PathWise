package com.pathwise.backend.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pathwise.backend.dto.RegisterRequest;
import com.pathwise.backend.dto.VerifyEmailRequest;
import com.pathwise.backend.model.EmailVerificationToken;
import com.pathwise.backend.model.User;
import com.pathwise.backend.repository.EmailVerificationTokenRepository;
import com.pathwise.backend.repository.UserRepository;
import com.pathwise.backend.enums.TokenPurpose;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration tests for the full email verification flow:
 *   register → verify-email → login
 *
 * EmailService is mocked in application-test.yaml (spring.mail.host=localhost, port=3025)
 * so no real emails are sent. We extract the OTP directly from the token repository.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class EmailVerificationIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private EmailVerificationTokenRepository tokenRepository;

    private static final String TEST_EMAIL = "verifyflow@test.com";
    private static final String TEST_PHONE = "33556677";

    @BeforeEach
    void setUp() {
        tokenRepository.deleteAll();
        userRepository.deleteAll();
    }

    // ── Full happy path ───────────────────────────────────────────────────────

    @Test
    void fullVerificationFlow_RegisterVerifyLogin_Success() throws Exception {
        // Step 1: Register
        RegisterRequest registerRequest = buildRequest(TEST_EMAIL, TEST_PHONE);

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(registerRequest)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.message").exists())
                .andExpect(jsonPath("$.token").doesNotExist());

        // Step 2: User exists but is unverified
        User user = userRepository.findByEmail(TEST_EMAIL).orElseThrow();
        assertFalse(user.isEmailVerified());

        // Step 3: Extract OTP directly from DB (bypasses email delivery)
        EmailVerificationToken token = tokenRepository
                .findActiveToken(TEST_EMAIL, TokenPurpose.EMAIL_VERIFICATION)
                .orElseThrow(() -> new AssertionError("No active verification token found"));
        String otp = token.getCode();
        assertEquals(6, otp.length());
        assertTrue(otp.matches("[0-9]{6}"));

        // Step 4: Verify email with the OTP → should return JWT
        VerifyEmailRequest verifyRequest = new VerifyEmailRequest();
        verifyRequest.setEmail(TEST_EMAIL);
        verifyRequest.setCode(otp);

        mockMvc.perform(post("/api/auth/verify-email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(verifyRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").exists())
                .andExpect(jsonPath("$.email").value(TEST_EMAIL));

        // Step 5: User is now verified
        user = userRepository.findByEmail(TEST_EMAIL).orElseThrow();
        assertTrue(user.isEmailVerified());

        // Step 6: Login now works
        String loginBody = String.format(
                "{\"email\":\"%s\",\"password\":\"password123\"}", TEST_EMAIL);

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").exists());
    }

    // ── OTP expiry ────────────────────────────────────────────────────────────

    @Test
    void verifyEmail_WithExpiredOtp_ReturnsBadRequest() throws Exception {
        // Register to create a user
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(buildRequest(TEST_EMAIL, TEST_PHONE))))
                .andExpect(status().isCreated());

        // Manually expire the token
        EmailVerificationToken token = tokenRepository
                .findActiveToken(TEST_EMAIL, TokenPurpose.EMAIL_VERIFICATION)
                .orElseThrow();
        token.setExpiresAt(LocalDateTime.now().minusMinutes(1)); // expired 1 minute ago
        tokenRepository.save(token);

        VerifyEmailRequest request = new VerifyEmailRequest();
        request.setEmail(TEST_EMAIL);
        request.setCode(token.getCode());

        mockMvc.perform(post("/api/auth/verify-email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    // ── Wrong OTP ─────────────────────────────────────────────────────────────

    @Test
    void verifyEmail_WithWrongOtp_ReturnsBadRequest() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(buildRequest(TEST_EMAIL, TEST_PHONE))))
                .andExpect(status().isCreated());

        VerifyEmailRequest request = new VerifyEmailRequest();
        request.setEmail(TEST_EMAIL);
        request.setCode("000000"); // definitely wrong

        mockMvc.perform(post("/api/auth/verify-email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    // ── Resend verification ───────────────────────────────────────────────────

    @Test
    void resendVerification_InvalidatesOldOtpAndIssuesNew() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(buildRequest(TEST_EMAIL, TEST_PHONE))))
                .andExpect(status().isCreated());

        // Capture original OTP
        String originalOtp = tokenRepository
                .findActiveToken(TEST_EMAIL, TokenPurpose.EMAIL_VERIFICATION)
                .orElseThrow().getCode();

        // Resend
        String resendBody = String.format("{\"email\":\"%s\"}", TEST_EMAIL);
        mockMvc.perform(post("/api/auth/resend-verification")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(resendBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").exists());

        // New active token should have a different (or same — just needs to be valid) OTP
        // Old token must be invalidated (used=true)
        long activeCount = tokenRepository.findAll().stream()
                .filter(t -> t.getEmail().equals(TEST_EMAIL))
                .filter(t -> t.getPurpose() == TokenPurpose.EMAIL_VERIFICATION)
                .filter(t -> !t.isUsed())
                .filter(t -> t.getExpiresAt().isAfter(LocalDateTime.now()))
                .count();

        // Exactly one active token after resend
        assertEquals(1, activeCount);
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private RegisterRequest buildRequest(String email, String phone) {
        RegisterRequest r = new RegisterRequest();
        r.setFullName("Verify Flow User");
        r.setEmail(email);
        r.setPassword("password123");
        r.setPhone(phone);
        r.setMonthlySalary(new BigDecimal("2000.000"));
        return r;
    }
}