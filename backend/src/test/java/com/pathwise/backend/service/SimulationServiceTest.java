package com.pathwise.backend.service;

import com.pathwise.backend.config.TestDataFactory;
import com.pathwise.backend.dto.SimulationRequest;
import com.pathwise.backend.dto.SimulationResponse;
import com.pathwise.backend.exception.GoalNotFoundException;
import com.pathwise.backend.exception.UnauthorizedAccessException;
import com.pathwise.backend.model.Goal;
import com.pathwise.backend.model.Simulation;
import com.pathwise.backend.model.User;
import com.pathwise.backend.repository.GoalRepository;
import com.pathwise.backend.repository.SimulationRepository;
import com.pathwise.backend.repository.UserRepository;
import com.pathwise.backend.service.FinancialProfileService.FinancialSnapshot;
import com.pathwise.backend.service.FinancialProfileService.WarningLevel;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SimulationServiceTest {

    @Mock private GoalRepository          goalRepository;
    @Mock private UserRepository          userRepository;
    @Mock private SimulationRepository    simulationRepository;
    @Mock private FinancialProfileService financialProfileService;

    @InjectMocks
    private SimulationService simulationService;

    private User             testUser;
    private User             otherUser;
    private Goal             testGoal;
    private FinancialSnapshot mockSnapshot;

    @BeforeEach
    void setUp() {
        Authentication auth = mock(Authentication.class);
        when(auth.getName()).thenReturn("test@example.com");
        SecurityContext ctx = mock(SecurityContext.class);
        when(ctx.getAuthentication()).thenReturn(auth);
        SecurityContextHolder.setContext(ctx);

        testUser  = TestDataFactory.createTestUser();
        otherUser = TestDataFactory.createOtherUser();
        testGoal  = TestDataFactory.createTestGoal(testUser);
        // testGoal: target=5000, saved=1000, remaining=4000

        mockSnapshot = new FinancialSnapshot(
                new BigDecimal("2000.000"),
                new BigDecimal("500.000"),
                new BigDecimal("1500.000"),
                new BigDecimal("0.000"),
                0.0,
                WarningLevel.NONE,
                null
        );
    }

    // ── simulate ──────────────────────────────────────────────────────────────

    @Test
    void simulate_WithValidData_ReturnsSimulationResponse() {
        SimulationRequest request = TestDataFactory.createValidSimulationRequest(testGoal.getId());

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(goalRepository.findById(testGoal.getId())).thenReturn(Optional.of(testGoal));
        when(financialProfileService.getSnapshot(testUser)).thenReturn(mockSnapshot);
        when(simulationRepository.save(any(Simulation.class))).thenReturn(
                TestDataFactory.createTestSimulation(testUser, testGoal));

        SimulationResponse response = simulationService.simulate(request);

        assertNotNull(response);
        assertEquals(testGoal.getId(), response.getGoalId());
        assertEquals("Emergency Fund", response.getGoalName());
    }

    @Test
    void simulate_CalculatesSimulatedMonthlyTarget() {
        // current=200, adjustments={FOOD:80, SUBSCRIPTIONS:25} → simulated=305
        SimulationRequest request = TestDataFactory.createValidSimulationRequest(testGoal.getId());

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(goalRepository.findById(testGoal.getId())).thenReturn(Optional.of(testGoal));
        when(financialProfileService.getSnapshot(testUser)).thenReturn(mockSnapshot);
        when(simulationRepository.save(any(Simulation.class))).thenReturn(
                TestDataFactory.createTestSimulation(testUser, testGoal));

        SimulationResponse response = simulationService.simulate(request);

        assertEquals(0, new BigDecimal("305.000").compareTo(response.getSimulatedMonthlySavingsTarget()));
    }

    @Test
    void simulate_SimulatedMonthsLessThanBaseline() {
        // spending more per month → fewer months to goal
        SimulationRequest request = TestDataFactory.createValidSimulationRequest(testGoal.getId());

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(goalRepository.findById(testGoal.getId())).thenReturn(Optional.of(testGoal));
        when(financialProfileService.getSnapshot(testUser)).thenReturn(mockSnapshot);
        when(simulationRepository.save(any(Simulation.class))).thenReturn(
                TestDataFactory.createTestSimulation(testUser, testGoal));

        SimulationResponse response = simulationService.simulate(request);

        assertTrue(response.getSimulatedMonths() < response.getBaselineMonths(),
                "Simulated months should be fewer than baseline when adjustments are positive");
        assertTrue(response.getMonthsSaved() > 0);
    }

    @Test
    void simulate_WithEmptyAdjustments_SimulatedEqualsBaseline() {
        SimulationRequest request = new SimulationRequest();
        request.setGoalId(testGoal.getId());
        request.setCurrentMonthlySavingsTarget(new BigDecimal("200.000"));
        request.setSpendingAdjustments(Map.of()); // no cuts

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(goalRepository.findById(testGoal.getId())).thenReturn(Optional.of(testGoal));
        when(financialProfileService.getSnapshot(testUser)).thenReturn(mockSnapshot);
        when(simulationRepository.save(any(Simulation.class))).thenReturn(
                TestDataFactory.createTestSimulation(testUser, testGoal));

        SimulationResponse response = simulationService.simulate(request);

        assertEquals(response.getBaselineMonths(), response.getSimulatedMonths());
        assertEquals(0L, response.getMonthsSaved());
    }

    @Test
    void simulate_PersistsSimulationToRepository() {
        SimulationRequest request = TestDataFactory.createValidSimulationRequest(testGoal.getId());

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(goalRepository.findById(testGoal.getId())).thenReturn(Optional.of(testGoal));
        when(financialProfileService.getSnapshot(testUser)).thenReturn(mockSnapshot);
        when(simulationRepository.save(any(Simulation.class))).thenReturn(
                TestDataFactory.createTestSimulation(testUser, testGoal));

        simulationService.simulate(request);

        verify(simulationRepository).save(any(Simulation.class));
    }

    @Test
    void simulate_IncludesBothCharts() {
        SimulationRequest request = TestDataFactory.createValidSimulationRequest(testGoal.getId());

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(goalRepository.findById(testGoal.getId())).thenReturn(Optional.of(testGoal));
        when(financialProfileService.getSnapshot(testUser)).thenReturn(mockSnapshot);
        when(simulationRepository.save(any(Simulation.class))).thenReturn(
                TestDataFactory.createTestSimulation(testUser, testGoal));

        SimulationResponse response = simulationService.simulate(request);

        assertNotNull(response.getBaselineChart());
        assertNotNull(response.getSimulatedChart());
        assertFalse(response.getBaselineChart().isEmpty());
        assertFalse(response.getSimulatedChart().isEmpty());
    }

    @Test
    void simulate_ChartStartsWithSavedAmount() {
        SimulationRequest request = TestDataFactory.createValidSimulationRequest(testGoal.getId());

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(goalRepository.findById(testGoal.getId())).thenReturn(Optional.of(testGoal));
        when(financialProfileService.getSnapshot(testUser)).thenReturn(mockSnapshot);
        when(simulationRepository.save(any(Simulation.class))).thenReturn(
                TestDataFactory.createTestSimulation(testUser, testGoal));

        SimulationResponse response = simulationService.simulate(request);

        // Both charts start from the current saved amount (1000)
        assertEquals(testGoal.getSavedAmount(),
                response.getBaselineChart().get(0).getAmount());
        assertEquals(testGoal.getSavedAmount(),
                response.getSimulatedChart().get(0).getAmount());
    }

    @Test
    void simulate_WhenGoalAlreadyComplete_ReturnsZeroMonths() {
        testGoal.setSavedAmount(testGoal.getTargetAmount()); // fully saved

        SimulationRequest request = new SimulationRequest();
        request.setGoalId(testGoal.getId());
        request.setCurrentMonthlySavingsTarget(new BigDecimal("200.000"));
        request.setSpendingAdjustments(Map.of("FOOD", new BigDecimal("50.000")));

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(goalRepository.findById(testGoal.getId())).thenReturn(Optional.of(testGoal));
        when(financialProfileService.getSnapshot(testUser)).thenReturn(mockSnapshot);
        when(simulationRepository.save(any(Simulation.class))).thenReturn(
                TestDataFactory.createTestSimulation(testUser, testGoal));

        SimulationResponse response = simulationService.simulate(request);

        assertEquals(0L, response.getBaselineMonths());
        assertEquals(0L, response.getSimulatedMonths());
    }

    @Test
    void simulate_WithNonExistentGoal_ThrowsGoalNotFoundException() {
        SimulationRequest request = new SimulationRequest();
        request.setGoalId(UUID.randomUUID());
        request.setCurrentMonthlySavingsTarget(new BigDecimal("200.000"));
        request.setSpendingAdjustments(Map.of());

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(goalRepository.findById(any(UUID.class))).thenReturn(Optional.empty());

        assertThrows(GoalNotFoundException.class, () -> simulationService.simulate(request));
    }

    @Test
    void simulate_ByUnauthorizedUser_ThrowsUnauthorizedAccessException() {
        SimulationRequest request = TestDataFactory.createValidSimulationRequest(testGoal.getId());

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(otherUser));
        when(goalRepository.findById(testGoal.getId())).thenReturn(Optional.of(testGoal));

        assertThrows(UnauthorizedAccessException.class, () -> simulationService.simulate(request));
        verify(simulationRepository, never()).save(any());
    }

    // ── getSavedSimulations ───────────────────────────────────────────────────

    @Test
    void getSavedSimulations_ReturnsSimulationsForGoal() {
        Simulation sim = TestDataFactory.createTestSimulation(testUser, testGoal);

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(goalRepository.findById(testGoal.getId())).thenReturn(Optional.of(testGoal));
        when(simulationRepository.findByGoalId(testGoal.getId())).thenReturn(List.of(sim));

        List<SimulationResponse> responses = simulationService.getSavedSimulations(testGoal.getId());

        assertEquals(1, responses.size());
        assertEquals(testGoal.getId(), responses.get(0).getGoalId());
    }

    @Test
    void getSavedSimulations_WhenNoHistory_ReturnsEmptyList() {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(goalRepository.findById(testGoal.getId())).thenReturn(Optional.of(testGoal));
        when(simulationRepository.findByGoalId(testGoal.getId())).thenReturn(List.of());

        List<SimulationResponse> responses = simulationService.getSavedSimulations(testGoal.getId());

        assertTrue(responses.isEmpty());
    }

    @Test
    void getSavedSimulations_ByUnauthorizedUser_ThrowsUnauthorizedAccessException() {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(otherUser));
        when(goalRepository.findById(testGoal.getId())).thenReturn(Optional.of(testGoal));

        assertThrows(UnauthorizedAccessException.class,
                () -> simulationService.getSavedSimulations(testGoal.getId()));
    }
}