package com.pathwise.backend.integration;
import com.pathwise.backend.repository.EmailVerificationTokenRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pathwise.backend.repository.GoalRepository;
import com.pathwise.backend.repository.SimulationRepository;
import com.pathwise.backend.dto.LoginRequest;
import com.pathwise.backend.dto.RegisterRequest;
import com.pathwise.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private SimulationRepository simulationRepository;
    @Autowired private GoalRepository goalRepository;
    @Autowired private EmailVerificationTokenRepository tokenRepository;
    // Note: phone must be exactly 8 digits (no country code) per RegisterRequest @Pattern
    private static final String VALID_PHONE = "33445566";

    @BeforeEach
    void setUp() {
        simulationRepository.deleteAll();  // Delete simulations first (they reference goals)
        goalRepository.deleteAll();        // Then delete goals (they reference users)
        tokenRepository.deleteAll();       // Then delete tokens (they reference users)
        userRepository.deleteAll();        // Finally delete users
    }

    // ── Registration ──────────────────────────────────────────────────────────

    @Test
    void register_WithValidData_Returns201WithMessage() throws Exception {
        RegisterRequest request = buildRegisterRequest("integration@test.com", VALID_PHONE);

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                // New contract: register returns a message, NOT a token
                .andExpect(jsonPath("$.message").exists())
                // No token at this stage — user must verify email first
                .andExpect(jsonPath("$.token").doesNotExist());
    }

    @Test
    void register_WithDuplicateEmail_ReturnsConflict() throws Exception {
        RegisterRequest request = buildRegisterRequest("duplicate@test.com", VALID_PHONE);

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated());

        // Second registration with same email → 409
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isConflict());
    }

    @Test
    void register_WithInvalidEmail_ReturnsBadRequest() throws Exception {
        RegisterRequest request = buildRegisterRequest("not-an-email", VALID_PHONE);

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void register_WithInvalidPhone_ReturnsBadRequest() throws Exception {
        // Phone with country code prefix — fails @Pattern("^[0-9]{8}$")
        RegisterRequest request = buildRegisterRequest("user@test.com", "+97312345678");

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    // ── Login before verification ─────────────────────────────────────────────

    @Test
    void login_BeforeEmailVerification_ReturnsForbiddenWithEmailNotVerifiedCode() throws Exception {
        // Register but do NOT verify — login must be blocked
        RegisterRequest registerRequest = buildRegisterRequest("unverified@test.com", VALID_PHONE);

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(registerRequest)))
                .andExpect(status().isCreated());

        LoginRequest loginRequest = new LoginRequest();
        loginRequest.setEmail("unverified@test.com");
        loginRequest.setPassword("password123");

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("EMAIL_NOT_VERIFIED"));
    }

    // ── Login errors ──────────────────────────────────────────────────────────

    @Test
    void login_WithWrongPassword_ReturnsUnauthorized() throws Exception {
        LoginRequest loginRequest = new LoginRequest();
        loginRequest.setEmail("nonexistent@test.com");
        loginRequest.setPassword("wrongpassword");

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isUnauthorized());
    }

    // ── Forgot password ───────────────────────────────────────────────────────

    @Test
    void forgotPassword_AlwaysReturns200_EvenForUnknownEmail() throws Exception {
        // Security: should never confirm or deny whether an email is registered
        String body = "{\"email\":\"doesnotexist@test.com\"}";

        mockMvc.perform(post("/api/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").exists());
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private RegisterRequest buildRegisterRequest(String email, String phone) {
        RegisterRequest r = new RegisterRequest();
        r.setFullName("Integration User");
        r.setEmail(email);
        r.setPassword("password123");
        r.setPhone(phone);
        r.setMonthlySalary(new BigDecimal("2500.000"));
        return r;
    }
}