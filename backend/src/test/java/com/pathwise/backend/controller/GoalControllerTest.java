package com.pathwise.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pathwise.backend.config.TestDataFactory;
import com.pathwise.backend.config.TestSecurityConfig;
import com.pathwise.backend.dto.GoalRequest;
import com.pathwise.backend.dto.GoalResponse;
import com.pathwise.backend.exception.GoalNotFoundException;
import com.pathwise.backend.exception.UnauthorizedAccessException;
import com.pathwise.backend.service.GoalService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(GoalController.class)
@Import({TestSecurityConfig.class, TestDataFactory.class})
class GoalControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private GoalService goalService;

    private GoalRequest validGoalRequest;
    private GoalResponse goalResponse;
    private UUID goalId;

    @BeforeEach
    void setUp() {
        validGoalRequest = TestDataFactory.createValidGoalRequest();
        goalResponse = TestDataFactory.createGoalResponse();
        goalId = goalResponse.getId();
    }

    @Test
    @WithMockUser
    void getAllGoals_ReturnsOkWithList() throws Exception {
        when(goalService.getAllGoals()).thenReturn(List.of(goalResponse));

        mockMvc.perform(get("/api/goals"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Emergency Fund"))
                .andExpect(jsonPath("$[0].progressPercentage").value(20.0));
    }

    @Test
    void getAllGoals_WithoutAuth_ReturnsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/goals"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser
    void getGoalById_WithValidId_ReturnsOk() throws Exception {
        when(goalService.getGoalById(goalId)).thenReturn(goalResponse);

        mockMvc.perform(get("/api/goals/{id}", goalId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(goalId.toString()));
    }

    @Test
    @WithMockUser
    void getGoalById_WithInvalidId_ReturnsNotFound() throws Exception {
        when(goalService.getGoalById(any(UUID.class)))
                .thenThrow(new GoalNotFoundException("Goal not found"));

        mockMvc.perform(get("/api/goals/{id}", UUID.randomUUID()))
                .andExpect(status().isNotFound());
    }

    @Test
    @WithMockUser
    void createGoal_WithValidData_ReturnsCreated() throws Exception {
        when(goalService.createGoal(any(GoalRequest.class))).thenReturn(goalResponse);

        mockMvc.perform(post("/api/goals")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validGoalRequest)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Emergency Fund"));
    }

    @Test
    @WithMockUser
    void createGoal_WithInvalidData_ReturnsBadRequest() throws Exception {
        validGoalRequest.setName("");

        mockMvc.perform(post("/api/goals")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validGoalRequest)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser
    void updateGoal_WithValidData_ReturnsOk() throws Exception {
        when(goalService.updateGoal(eq(goalId), any(GoalRequest.class))).thenReturn(goalResponse);

        mockMvc.perform(put("/api/goals/{id}", goalId)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validGoalRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Emergency Fund"));
    }

    @Test
    @WithMockUser
    void updateGoal_WithUnauthorizedUser_ReturnsForbidden() throws Exception {
        when(goalService.updateGoal(eq(goalId), any(GoalRequest.class)))
                .thenThrow(new UnauthorizedAccessException("Not authorized"));

        mockMvc.perform(put("/api/goals/{id}", goalId)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validGoalRequest)))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser
    void deleteGoal_WithValidId_ReturnsNoContent() throws Exception {
        mockMvc.perform(delete("/api/goals/{id}", goalId)
                        .with(csrf()))
                .andExpect(status().isNoContent());
    }

    @Test
    void deleteGoal_WithoutAuth_ReturnsUnauthorized() throws Exception {
        mockMvc.perform(delete("/api/goals/{id}", goalId)
                        .with(csrf()))
                .andExpect(status().isUnauthorized());
    }
}
