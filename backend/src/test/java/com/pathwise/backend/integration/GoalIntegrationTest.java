package com.pathwise.backend.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pathwise.backend.dto.GoalRequest;
import com.pathwise.backend.dto.LoginRequest;
import com.pathwise.backend.dto.RegisterRequest;
import com.pathwise.backend.enums.GoalCategory;
import com.pathwise.backend.enums.GoalPriority;
import com.pathwise.backend.repository.GoalRepository;
import com.pathwise.backend.repository.UserRepository;
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

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private GoalRepository goalRepository;

    private String authToken;

    @BeforeEach
    void setUp() throws Exception {
        goalRepository.deleteAll();
        userRepository.deleteAll();

        RegisterRequest registerRequest = new RegisterRequest();
        registerRequest.setFullName("Goal Tester");
        registerRequest.setEmail("goaltest@test.com");
        registerRequest.setPassword("password123");
        registerRequest.setPhone("+97312345678");
        registerRequest.setMonthlySalary(new BigDecimal("3000.000"));

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(registerRequest)))
                .andExpect(status().isCreated());

        LoginRequest loginRequest = new LoginRequest();
        loginRequest.setEmail("goaltest@test.com");
        loginRequest.setPassword("password123");

        MvcResult loginResult = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isOk())
                .andReturn();

        String response = loginResult.getResponse().getContentAsString();
        authToken = objectMapper.readTree(response).get("token").asText();
    }

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

        MvcResult createResult = mockMvc.perform(post("/api/goals")
                        .header("Authorization", "Bearer " + authToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(goalRequest)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Vacation Fund"))
                .andReturn();

        String goalId = objectMapper.readTree(createResult.getResponse().getContentAsString())
                .get("id").asText();

        mockMvc.perform(get("/api/goals")
                        .header("Authorization", "Bearer " + authToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Vacation Fund"));

        goalRequest.setName("European Vacation");
        goalRequest.setTargetAmount(new BigDecimal("3000.000"));

        mockMvc.perform(put("/api/goals/" + goalId)
                        .header("Authorization", "Bearer " + authToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(goalRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("European Vacation"))
                .andExpect(jsonPath("$.targetAmount").value(3000.0));

        mockMvc.perform(delete("/api/goals/" + goalId)
                        .header("Authorization", "Bearer " + authToken))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/goals/" + goalId)
                        .header("Authorization", "Bearer " + authToken))
                .andExpect(status().isNotFound());
    }

    @Test
    void accessGoal_WithoutAuth_ReturnsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/goals"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void createGoal_WithInvalidData_ReturnsBadRequest() throws Exception {
        GoalRequest invalidRequest = new GoalRequest();
        invalidRequest.setName("");

        mockMvc.perform(post("/api/goals")
                        .header("Authorization", "Bearer " + authToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidRequest)))
                .andExpect(status().isBadRequest());
    }
}