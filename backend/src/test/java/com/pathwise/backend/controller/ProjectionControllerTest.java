package com.pathwise.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.pathwise.backend.config.TestDataFactory;
import com.pathwise.backend.config.TestSecurityConfig;
import com.pathwise.backend.dto.ProjectionRequest;
import com.pathwise.backend.dto.ProjectionResponse;
import com.pathwise.backend.exception.GoalNotFoundException;
import com.pathwise.backend.exception.SavingsLimitExceededException;
import com.pathwise.backend.service.ProjectionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ProjectionController.class)
@Import({TestSecurityConfig.class, TestDataFactory.class})
class ProjectionControllerTest {

    @Autowired private MockMvc mockMvc;

    @MockitoBean private ProjectionService projectionService;

    private ObjectMapper objectMapper;
    private UUID goalId;
    private ProjectionResponse projectionResponse;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());

        goalId = UUID.randomUUID();

        projectionResponse = ProjectionResponse.builder()
                .goalId(goalId)
                .goalName("Emergency Fund")
                .targetAmount(new BigDecimal("5000.000"))
                .savedAmount(new BigDecimal("1000.000"))
                .monthlySavingsTarget(new BigDecimal("200.000"))
                .monthsNeeded(20L)
                .projectedCompletionDate(YearMonth.now().plusMonths(20))
                .deadline(YearMonth.now().plusYears(2))
                .isOnTrack(true)
                .monthsAheadOrBehind(4L)
                .chartData(List.of())
                .disposableIncome(new BigDecimal("1500.000"))
                .remainingAfterThisSaving(new BigDecimal("1300.000"))
                .warningLevel("NONE")
                .affordabilityNote("Affordable")
                .build();
    }

    // ── POST /api/goals/{id}/projection ───────────────────────────────────────

    @Test
    @WithMockUser
    void getProjection_WithValidData_ReturnsOk() throws Exception {
        when(projectionService.getProjection(eq(goalId), any(BigDecimal.class)))
                .thenReturn(projectionResponse);

        ProjectionRequest request = new ProjectionRequest();
        request.setMonthlySavingsRate(new BigDecimal("200.000"));

        mockMvc.perform(post("/api/goals/{id}/projection", goalId)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.goalId").value(goalId.toString()))
                .andExpect(jsonPath("$.goalName").value("Emergency Fund"))
                .andExpect(jsonPath("$.monthsNeeded").value(20))
                .andExpect(jsonPath("$.isOnTrack").value(true));
    }

    @Test
    @WithMockUser
    void getProjection_WithNullRate_ReturnsBadRequest() throws Exception {
        // monthlySavingsRate is @NotNull in ProjectionRequest
        String body = "{\"monthlySavingsRate\": null}";

        mockMvc.perform(post("/api/goals/{id}/projection", goalId)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser
    void getProjection_WithZeroRate_ReturnsBadRequest() throws Exception {
        // @DecimalMin("0.01") — zero not allowed
        ProjectionRequest request = new ProjectionRequest();
        request.setMonthlySavingsRate(BigDecimal.ZERO);

        mockMvc.perform(post("/api/goals/{id}/projection", goalId)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser
    void getProjection_WithNonExistentGoal_ReturnsNotFound() throws Exception {
        when(projectionService.getProjection(any(UUID.class), any(BigDecimal.class)))
                .thenThrow(new GoalNotFoundException("Goal not found"));

        ProjectionRequest request = new ProjectionRequest();
        request.setMonthlySavingsRate(new BigDecimal("200.000"));

        mockMvc.perform(post("/api/goals/{id}/projection", UUID.randomUUID())
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isNotFound());
    }

    @Test
    @WithMockUser
    void getProjection_WhenSavingsLimitExceeded_ReturnsUnprocessableEntity() throws Exception {
        when(projectionService.getProjection(any(UUID.class), any(BigDecimal.class)))
                .thenThrow(new SavingsLimitExceededException("Exceeds disposable income"));

        ProjectionRequest request = new ProjectionRequest();
        request.setMonthlySavingsRate(new BigDecimal("9999.000"));

        mockMvc.perform(post("/api/goals/{id}/projection", goalId)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnprocessableEntity());
    }

    @Test
    void getProjection_WithoutAuth_ReturnsUnauthorized() throws Exception {
        ProjectionRequest request = new ProjectionRequest();
        request.setMonthlySavingsRate(new BigDecimal("200.000"));

        mockMvc.perform(post("/api/goals/{id}/projection", goalId)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }
}