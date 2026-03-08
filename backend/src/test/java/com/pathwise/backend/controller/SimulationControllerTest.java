package com.pathwise.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.pathwise.backend.config.TestDataFactory;
import com.pathwise.backend.config.TestSecurityConfig;
import com.pathwise.backend.dto.SimulationRequest;
import com.pathwise.backend.dto.SimulationResponse;
import com.pathwise.backend.service.SimulationService;
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
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(SimulationController.class)
@Import({TestSecurityConfig.class, TestDataFactory.class})
class SimulationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    private ObjectMapper objectMapper;

    @MockitoBean
    private SimulationService simulationService;

    private SimulationRequest simulationRequest;
    private SimulationResponse simulationResponse;
    private UUID goalId;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());

        goalId = UUID.randomUUID();
        simulationRequest = TestDataFactory.createValidSimulationRequest(goalId);
        simulationResponse = TestDataFactory.createSimulationResponse(goalId);
    }

    // ─── POST /api/simulations (run a simulation) ─────────────────────────────

    @Test
    @WithMockUser
    void simulate_WithValidData_ReturnsOk() throws Exception {
        // SimulationService.simulate(request) is the method — not createSimulation
        when(simulationService.simulate(any(SimulationRequest.class)))
                .thenReturn(simulationResponse);

        mockMvc.perform(post("/api/simulations")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(simulationRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.goalId").value(goalId.toString()))
                .andExpect(jsonPath("$.goalName").value("Emergency Fund"));
    }

    @Test
    @WithMockUser
    void simulate_WithMissingGoalId_ReturnsBadRequest() throws Exception {
        simulationRequest.setGoalId(null);

        mockMvc.perform(post("/api/simulations")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(simulationRequest)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void simulate_WithoutAuth_ReturnsUnauthorized() throws Exception {
        mockMvc.perform(post("/api/simulations")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(simulationRequest)))
                .andExpect(status().isUnauthorized());
    }

    // ─── GET /api/simulations/{goalId} (saved simulations for a goal) ─────────

    @Test
    @WithMockUser
    void getSavedSimulations_WithValidGoalId_ReturnsOk() throws Exception {
        // SimulationService.getSavedSimulations(goalId) — not getAllSimulations()
        when(simulationService.getSavedSimulations(eq(goalId)))
                .thenReturn(List.of(simulationResponse));

        mockMvc.perform(get("/api/simulations/{goalId}", goalId))
                .andExpect(status().isOk());
    }

    @Test
    void getSavedSimulations_WithoutAuth_ReturnsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/simulations/{goalId}", goalId))
                .andExpect(status().isUnauthorized());
    }
}