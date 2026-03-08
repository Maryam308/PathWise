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
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Unit tests for SimulationService.
 *
 * SimulationService API:
 *   simulate(SimulationRequest)          → SimulationResponse
 *   getSavedSimulations(UUID goalId)     → List<SimulationResponse>
 *
 * SimulationRequest fields:
 *   goalId, currentMonthlySavingsTarget, spendingAdjustments (Map<String,BigDecimal>)
 */
@ExtendWith(MockitoExtension.class)
class SimulationServiceTest {

    @Mock private SimulationRepository simulationRepository;
    @Mock private GoalRepository       goalRepository;
    @Mock private UserRepository       userRepository;
    @Mock private FinancialProfileService financialProfileService;

    @InjectMocks
    private SimulationService simulationService;

    private User testUser;
    private User otherUser;
    private Goal testGoal;
    private SimulationRequest simulationRequest;
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

        simulationRequest = TestDataFactory.createValidSimulationRequest(testGoal.getId());

        mockSnapshot = new FinancialSnapshot(
                new BigDecimal("2000.000"),
                new BigDecimal("500.000"),
                new BigDecimal("1500.000"),
                new BigDecimal("200.000"),
                13.3,
                WarningLevel.NONE,
                null
        );
    }

    // ─── simulate() ───────────────────────────────────────────────────────────

    @Test
    void simulate_WithValidRequest_ReturnsSimulationResponse() {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(goalRepository.findById(testGoal.getId())).thenReturn(Optional.of(testGoal));
        when(financialProfileService.getSnapshot(testUser)).thenReturn(mockSnapshot);
        when(simulationRepository.save(any(Simulation.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        SimulationResponse response = simulationService.simulate(simulationRequest);

        assertNotNull(response);
        assertEquals(testGoal.getId(), response.getGoalId());
        assertEquals("Emergency Fund", response.getGoalName());
        assertNotNull(response.getSimulatedCompletionDate());
        assertTrue(response.getSimulatedMonths() <= response.getBaselineMonths(),
                "Simulation should complete faster than baseline");
        verify(simulationRepository).save(any(Simulation.class));
    }

    @Test
    void simulate_SpendingCutReducesCompletionTime() {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(goalRepository.findById(testGoal.getId())).thenReturn(Optional.of(testGoal));
        when(financialProfileService.getSnapshot(testUser)).thenReturn(mockSnapshot);
        when(simulationRepository.save(any(Simulation.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        SimulationResponse response = simulationService.simulate(simulationRequest);

        // totalAdjustment = FOOD(80) + SUBSCRIPTIONS(25) = 105
        assertEquals(new BigDecimal("105.000"), response.getTotalAdjustment());
        // simulatedMonthly = 200 + 105 = 305
        assertEquals(new BigDecimal("305.000"), response.getSimulatedMonthlySavingsTarget());
        assertTrue(response.getMonthsSaved() > 0, "Should save months vs baseline");
    }

    @Test
    void simulate_WithGoalAlreadyCompleted_ReturnsZeroMonths() {
        // If savedAmount >= targetAmount, remaining = 0 → 0 months needed
        testGoal.setSavedAmount(testGoal.getTargetAmount());

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(goalRepository.findById(testGoal.getId())).thenReturn(Optional.of(testGoal));
        when(financialProfileService.getSnapshot(testUser)).thenReturn(mockSnapshot);
        when(simulationRepository.save(any(Simulation.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        SimulationResponse response = simulationService.simulate(simulationRequest);

        assertEquals(0L, response.getBaselineMonths());
        assertEquals(0L, response.getSimulatedMonths());
    }

    @Test
    void simulate_WithNonExistentGoal_ThrowsGoalNotFoundException() {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(goalRepository.findById(testGoal.getId())).thenReturn(Optional.empty());

        assertThrows(GoalNotFoundException.class,
                () -> simulationService.simulate(simulationRequest));

        verify(simulationRepository, never()).save(any());
    }

    @Test
    void simulate_ByUnauthorizedUser_ThrowsUnauthorizedAccessException() {
        // otherUser doesn't own testGoal
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(otherUser));
        when(goalRepository.findById(testGoal.getId())).thenReturn(Optional.of(testGoal));

        assertThrows(UnauthorizedAccessException.class,
                () -> simulationService.simulate(simulationRequest));

        verify(simulationRepository, never()).save(any());
    }

    @Test
    void simulate_IncludesChartData() {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(goalRepository.findById(testGoal.getId())).thenReturn(Optional.of(testGoal));
        when(financialProfileService.getSnapshot(testUser)).thenReturn(mockSnapshot);
        when(simulationRepository.save(any(Simulation.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        SimulationResponse response = simulationService.simulate(simulationRequest);

        assertNotNull(response.getBaselineChart());
        assertNotNull(response.getSimulatedChart());
        assertFalse(response.getBaselineChart().isEmpty());
        assertFalse(response.getSimulatedChart().isEmpty());
    }

    @Test
    void simulate_WhenSimulatedRateExceedsDisposable_IncludesWarningNote() {
        // Set adjustments so simulated monthly > disposable income
        simulationRequest.setCurrentMonthlySavingsTarget(new BigDecimal("1400.000"));
        simulationRequest.setSpendingAdjustments(Map.of("FOOD", new BigDecimal("500.000")));
        // simulatedMonthly = 1400 + 500 = 1900 > disposable 1500 → warning

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(goalRepository.findById(testGoal.getId())).thenReturn(Optional.of(testGoal));
        when(financialProfileService.getSnapshot(testUser)).thenReturn(mockSnapshot);
        when(simulationRepository.save(any(Simulation.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        SimulationResponse response = simulationService.simulate(simulationRequest);

        assertNotNull(response.getAffordabilityNote());
        assertTrue(response.getAffordabilityNote().contains("Warning") ||
                response.getRemainingDisposableAfterSimulation()
                        .compareTo(BigDecimal.ZERO) < 0);
    }

    // ─── getSavedSimulations() ────────────────────────────────────────────────

    @Test
    void getSavedSimulations_ReturnsListForGoal() {
        Simulation saved = TestDataFactory.createTestSimulation(testUser, testGoal);

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(goalRepository.findById(testGoal.getId())).thenReturn(Optional.of(testGoal));
        when(simulationRepository.findByGoalId(testGoal.getId())).thenReturn(List.of(saved));

        List<SimulationResponse> results = simulationService.getSavedSimulations(testGoal.getId());

        assertEquals(1, results.size());
        assertEquals(testGoal.getId(), results.get(0).getGoalId());
    }

    @Test
    void getSavedSimulations_WithNoSavedSimulations_ReturnsEmptyList() {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(goalRepository.findById(testGoal.getId())).thenReturn(Optional.of(testGoal));
        when(simulationRepository.findByGoalId(testGoal.getId())).thenReturn(List.of());

        List<SimulationResponse> results = simulationService.getSavedSimulations(testGoal.getId());

        assertNotNull(results);
        assertTrue(results.isEmpty());
    }

    @Test
    void getSavedSimulations_ByUnauthorizedUser_ThrowsUnauthorizedAccessException() {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(otherUser));
        when(goalRepository.findById(testGoal.getId())).thenReturn(Optional.of(testGoal));

        assertThrows(UnauthorizedAccessException.class,
                () -> simulationService.getSavedSimulations(testGoal.getId()));
    }
}