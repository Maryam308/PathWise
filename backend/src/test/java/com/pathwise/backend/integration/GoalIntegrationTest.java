package com.pathwise.backend.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pathwise.backend.dto.GoalRequest;
import com.pathwise.backend.dto.RegisterRequest;
import com.pathwise.backend.enums.GoalCategory;
import com.pathwise.backend.enums.GoalPriority;
import com.pathwise.backend.model.User;
import com.pathwise.backend.repository.EmailVerificationTokenRepository;
import com.pathwise.backend.repository.GoalRepository;
import com.pathwise.backend.repository.SimulationRepository;
import com.pathwise.backend.repository.UserRepository;
import com.pathwise.backend.security.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.math.BigDecimal;
import java.time.YearMonth;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class GoalIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private GoalRepository goalRepository;
    @Autowired private EmailVerificationTokenRepository tokenRepository;
    @Autowired private JwtUtil jwtUtil;
    @Autowired private SimulationRepository simulationRepository;

    // Phone must be exactly 8 digits — no country code prefix
    private static final String VALID_PHONE = "33445566";

    private String authToken;

    @BeforeEach
    void setUp() throws Exception {
        simulationRepository.deleteAll();  // Delete simulations first (they reference goals)
        goalRepository.deleteAll();        // Then delete goals
        tokenRepository.deleteAll();       // Then delete tokens (they reference users)
        userRepository.deleteAll();        // Finally delete users

        // Register a user
        RegisterRequest registerRequest = new RegisterRequest();
        registerRequest.setFullName("Goal Tester");
        registerRequest.setEmail("goaltest@test.com");
        registerRequest.setPassword("password123");
        registerRequest.setPhone(VALID_PHONE);
        registerRequest.setMonthlySalary(new BigDecimal("3000.000"));

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(registerRequest)))
                .andExpect(status().isCreated());

        // Bypass email verification by directly marking the user as verified
        // and generating the token ourselves. This simulates a verified user
        // without requiring a real SMTP server in tests.
        User user = userRepository.findByEmail("goaltest@test.com")
                .orElseThrow(() -> new RuntimeException("Test setup failed: user not found"));
        user.setEmailVerified(true);
        userRepository.save(user);

        // Generate a real JWT directly (no HTTP call needed)
        authToken = jwtUtil.generateToken("goaltest@test.com");
    }

    // ── Full goal lifecycle ───────────────────────────────────────────────────

    @Test
    void completeGoalLifecycle_CreateUpdateDelete_Success() throws Exception {
        GoalRequest goalRequest = new GoalRequest();
        goalRequest.setName("Vacation Fund");
        goalRequest.setCategory(GoalCategory.TRAVEL);
        goalRequest.setTargetAmount(new BigDecimal("2000.000"));
        goalRequest.setSavedAmount(new BigDecimal("500.000"));
        goalRequest.setDeadline(YearMonth.now().plusMonths(6));
        goalRequest.setPriority(GoalPriority.MEDIUM);
        goalRequest.setCurrency("BHD");

        // Create
        MvcResult createResult = mockMvc.perform(post("/api/goals")
                        .header("Authorization", "Bearer " + authToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(goalRequest)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Vacation Fund"))
                .andExpect(jsonPath("$.progressPercentage").value(25.0))
                .andReturn();

        String goalId = objectMapper.readTree(createResult.getResponse().getContentAsString())
                .get("id").asText();

        // Read all
        mockMvc.perform(get("/api/goals")
                        .header("Authorization", "Bearer " + authToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Vacation Fund"));

        // Update
        goalRequest.setName("European Vacation");
        goalRequest.setTargetAmount(new BigDecimal("3000.000"));

        mockMvc.perform(put("/api/goals/" + goalId)
                        .header("Authorization", "Bearer " + authToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(goalRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("European Vacation"))
                .andExpect(jsonPath("$.targetAmount").value(3000.0));

        // Delete
        mockMvc.perform(delete("/api/goals/" + goalId)
                        .header("Authorization", "Bearer " + authToken))
                .andExpect(status().isNoContent());

        // Confirm deleted
        mockMvc.perform(get("/api/goals/" + goalId)
                        .header("Authorization", "Bearer " + authToken))
                .andExpect(status().isNotFound());
    }

    // ── Auth protection ───────────────────────────────────────────────────────

    @Test
    void accessGoal_WithoutAuth_ReturnsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/goals"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void accessGoal_WithExpiredToken_ReturnsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/goals")
                        .header("Authorization", "Bearer invalid.token.here"))
                .andExpect(status().isUnauthorized());
    }

    // ── Validation ────────────────────────────────────────────────────────────

    @Test
    void createGoal_WithInvalidData_ReturnsBadRequest() throws Exception {
        GoalRequest invalidRequest = new GoalRequest();
        invalidRequest.setName(""); // @NotBlank violation

        mockMvc.perform(post("/api/goals")
                        .header("Authorization", "Bearer " + authToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidRequest)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields").exists()); // ErrorResponse includes field errors
    }

    @Test
    void getGoal_WithNonExistentId_ReturnsNotFound() throws Exception {
        mockMvc.perform(get("/api/goals/00000000-0000-0000-0000-000000000000")
                        .header("Authorization", "Bearer " + authToken))
                .andExpect(status().isNotFound());
    }
}