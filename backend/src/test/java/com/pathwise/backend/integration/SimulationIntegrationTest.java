package com.pathwise.backend.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pathwise.backend.dto.GoalRequest;
import com.pathwise.backend.dto.RegisterRequest;
import com.pathwise.backend.dto.SimulationRequest;
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
import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SimulationIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private GoalRepository goalRepository;
    @Autowired private SimulationRepository simulationRepository;
    @Autowired private EmailVerificationTokenRepository tokenRepository;
    @Autowired private JwtUtil jwtUtil;

    private String authToken;
    private String goalId;

    @BeforeEach
    void setUp() throws Exception {
        simulationRepository.deleteAll();
        goalRepository.deleteAll();
        tokenRepository.deleteAll();
        userRepository.deleteAll();

        // Register and bypass email verification
        RegisterRequest registerRequest = new RegisterRequest();
        registerRequest.setFullName("Sim Tester");
        registerRequest.setEmail("simtest@test.com");
        registerRequest.setPassword("password123");
        registerRequest.setPhone("33445577");
        registerRequest.setMonthlySalary(new BigDecimal("3000.000"));

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(registerRequest)))
                .andExpect(status().isCreated());

        User user = userRepository.findByEmail("simtest@test.com")
                .orElseThrow();
        user.setEmailVerified(true);
        userRepository.save(user);

        authToken = jwtUtil.generateToken("simtest@test.com");

        // Create a goal to simulate against
        GoalRequest goalRequest = new GoalRequest();
        goalRequest.setName("Car Fund");
        goalRequest.setCategory(GoalCategory.CAR);
        goalRequest.setTargetAmount(new BigDecimal("5000.000"));
        goalRequest.setSavedAmount(new BigDecimal("1000.000"));
        goalRequest.setDeadline(YearMonth.now().plusYears(2));
        goalRequest.setPriority(GoalPriority.MEDIUM);
        goalRequest.setCurrency("BHD");

        MvcResult createResult = mockMvc.perform(post("/api/goals")
                        .header("Authorization", "Bearer " + authToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(goalRequest)))
                .andExpect(status().isCreated())
                .andReturn();

        goalId = objectMapper.readTree(createResult.getResponse().getContentAsString())
                .get("id").asText();
    }

    // ── POST /api/simulations ─────────────────────────────────────────────────

    @Test
    void simulate_WithValidData_ReturnsSimulationAndSavesIt() throws Exception {
        SimulationRequest request = new SimulationRequest();
        request.setGoalId(java.util.UUID.fromString(goalId));
        request.setCurrentMonthlySavingsTarget(new BigDecimal("200.000"));
        request.setSpendingAdjustments(Map.of("FOOD", new BigDecimal("80.000")));

        mockMvc.perform(post("/api/simulations")
                        .header("Authorization", "Bearer " + authToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.goalId").value(goalId))
                .andExpect(jsonPath("$.goalName").value("Car Fund"))
                .andExpect(jsonPath("$.simulatedMonthlySavingsTarget").value(280.0))
                .andExpect(jsonPath("$.totalAdjustment").value(80.0))
                .andExpect(jsonPath("$.baselineChart").isArray())
                .andExpect(jsonPath("$.simulatedChart").isArray());
    }

    @Test
    void simulate_WithoutAuth_ReturnsUnauthorized() throws Exception {
        SimulationRequest request = new SimulationRequest();
        request.setGoalId(java.util.UUID.fromString(goalId));
        request.setCurrentMonthlySavingsTarget(new BigDecimal("200.000"));
        request.setSpendingAdjustments(Map.of("FOOD", new BigDecimal("50.000")));

        mockMvc.perform(post("/api/simulations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void simulate_WithMissingGoalId_ReturnsBadRequest() throws Exception {
        String body = "{\"currentMonthlySavingsTarget\": 200, \"spendingAdjustments\": {\"FOOD\": 50}}";

        mockMvc.perform(post("/api/simulations")
                        .header("Authorization", "Bearer " + authToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());
    }

    // ── GET /api/simulations/{goalId} ─────────────────────────────────────────

    @Test
    void getSavedSimulations_AfterRunning_ReturnsSavedSimulation() throws Exception {
        // Run a simulation first
        SimulationRequest request = new SimulationRequest();
        request.setGoalId(java.util.UUID.fromString(goalId));
        request.setCurrentMonthlySavingsTarget(new BigDecimal("200.000"));
        request.setSpendingAdjustments(Map.of("FOOD", new BigDecimal("80.000")));

        mockMvc.perform(post("/api/simulations")
                        .header("Authorization", "Bearer " + authToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());

        // Now fetch saved simulations for that goal
        mockMvc.perform(get("/api/simulations/{goalId}", goalId)
                        .header("Authorization", "Bearer " + authToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$[0].goalId").value(goalId));
    }

    @Test
    void getSavedSimulations_WithNoHistory_ReturnsEmptyArray() throws Exception {
        mockMvc.perform(get("/api/simulations/{goalId}", goalId)
                        .header("Authorization", "Bearer " + authToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$").isEmpty());
    }
}