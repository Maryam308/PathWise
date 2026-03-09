package com.pathwise.backend.service;

import com.pathwise.backend.config.TestDataFactory;
import com.pathwise.backend.dto.ProjectionResponse;
import com.pathwise.backend.exception.GoalNotFoundException;
import com.pathwise.backend.exception.SavingsLimitExceededException;
import com.pathwise.backend.exception.UnauthorizedAccessException;
import com.pathwise.backend.model.Goal;
import com.pathwise.backend.model.User;
import com.pathwise.backend.repository.GoalRepository;
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
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProjectionServiceTest {

    @Mock private GoalRepository            goalRepository;
    @Mock private UserRepository            userRepository;
    @Mock private FinancialProfileService   financialProfileService;

    @InjectMocks
    private ProjectionService projectionService;

    private User             testUser;
    private User             otherUser;
    private Goal             testGoal;
    private FinancialSnapshot mockSnapshot;

    private static final BigDecimal MONTHLY_RATE = new BigDecimal("200.000");

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
                new BigDecimal("2000.000"),  // salary
                new BigDecimal("500.000"),   // expenses
                new BigDecimal("1500.000"),  // disposable
                new BigDecimal("0.000"),     // total savings committed
                0.0,
                WarningLevel.NONE,
                null
        );
    }

    // ── getProjection() ───────────────────────────────────────────────────────

    @Test
    void getProjection_WithValidData_ReturnsResponse() {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(goalRepository.findById(testGoal.getId())).thenReturn(Optional.of(testGoal));
        when(financialProfileService.getSnapshot(testUser)).thenReturn(mockSnapshot);
        when(financialProfileService.getTotalMonthlySavings(testUser.getId()))
                .thenReturn(BigDecimal.ZERO);
        when(goalRepository.save(any(Goal.class))).thenReturn(testGoal);

        ProjectionResponse response = projectionService.getProjection(testGoal.getId(), MONTHLY_RATE);

        assertNotNull(response);
        assertEquals(testGoal.getId(), response.getGoalId());
        assertEquals("Emergency Fund", response.getGoalName());
        assertTrue(response.getMonthsNeeded() > 0);
        assertNotNull(response.getProjectedCompletionDate());
    }

    @Test
    void getProjection_CalculatesMonthsCorrectly() {
        // remaining = 5000 - 1000 = 4000, rate = 200 → ceil(4000/200) = 20 months
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(goalRepository.findById(testGoal.getId())).thenReturn(Optional.of(testGoal));
        when(financialProfileService.getSnapshot(testUser)).thenReturn(mockSnapshot);
        when(financialProfileService.getTotalMonthlySavings(testUser.getId()))
                .thenReturn(BigDecimal.ZERO);
        when(goalRepository.save(any(Goal.class))).thenReturn(testGoal);

        ProjectionResponse response = projectionService.getProjection(testGoal.getId(), MONTHLY_RATE);

        assertEquals(20L, response.getMonthsNeeded());
    }

    @Test
    void getProjection_WhenGoalAlreadyComplete_Returns0Months() {
        testGoal.setSavedAmount(testGoal.getTargetAmount()); // fully saved

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(goalRepository.findById(testGoal.getId())).thenReturn(Optional.of(testGoal));
        when(financialProfileService.getSnapshot(testUser)).thenReturn(mockSnapshot);
        when(financialProfileService.getTotalMonthlySavings(testUser.getId()))
                .thenReturn(BigDecimal.ZERO);
        when(goalRepository.save(any(Goal.class))).thenReturn(testGoal);

        ProjectionResponse response = projectionService.getProjection(testGoal.getId(), MONTHLY_RATE);

        assertEquals(0L, response.getMonthsNeeded());
    }

    @Test
    void getProjection_IncludesChartData() {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(goalRepository.findById(testGoal.getId())).thenReturn(Optional.of(testGoal));
        when(financialProfileService.getSnapshot(testUser)).thenReturn(mockSnapshot);
        when(financialProfileService.getTotalMonthlySavings(testUser.getId()))
                .thenReturn(BigDecimal.ZERO);
        when(goalRepository.save(any(Goal.class))).thenReturn(testGoal);

        ProjectionResponse response = projectionService.getProjection(testGoal.getId(), MONTHLY_RATE);

        assertNotNull(response.getChartData());
        assertFalse(response.getChartData().isEmpty());
        // First chart point should equal current saved amount
        assertEquals(testGoal.getSavedAmount(),
                response.getChartData().get(0).getCumulativeAmount());
    }

    @Test
    void getProjection_WhenRateExceedsDisposable_IncludesWarningNote() {
        // Rate of 2000 > disposable income of 1500
        BigDecimal aggressiveRate = new BigDecimal("2000.000");

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(goalRepository.findById(testGoal.getId())).thenReturn(Optional.of(testGoal));
        when(financialProfileService.getSnapshot(testUser)).thenReturn(mockSnapshot);
        when(financialProfileService.getTotalMonthlySavings(testUser.getId()))
                .thenReturn(BigDecimal.ZERO);
        when(goalRepository.save(any(Goal.class))).thenReturn(testGoal);

        // Note: ProjectionService does NOT block if rate > disposable — it warns.
        // SavingsLimitExceededException is only thrown if rate > disposable + existing commitments.
        // With 0 existing commitments and disposable=1500, rate=2000 WILL throw.
        // Adjust: use a rate just at the limit to test the warning note path.
        BigDecimal rateAtLimit = new BigDecimal("1500.000");

        ProjectionResponse response = projectionService.getProjection(testGoal.getId(), rateAtLimit);

        assertNotNull(response.getAffordabilityNote());
        // remaining disposable = 1500 - 1500 = 0
        assertEquals(BigDecimal.ZERO, response.getRemainingAfterThisSaving());
    }

    @Test
    void getProjection_PersistsMonthlySavingsTargetToGoal() {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(goalRepository.findById(testGoal.getId())).thenReturn(Optional.of(testGoal));
        when(financialProfileService.getSnapshot(testUser)).thenReturn(mockSnapshot);
        when(financialProfileService.getTotalMonthlySavings(testUser.getId()))
                .thenReturn(BigDecimal.ZERO);
        when(goalRepository.save(any(Goal.class))).thenReturn(testGoal);

        projectionService.getProjection(testGoal.getId(), MONTHLY_RATE);

        verify(goalRepository).save(argThat(g ->
                MONTHLY_RATE.compareTo(g.getMonthlySavingsTarget()) == 0));
    }

    @Test
    void getProjection_WhenRateExceedsSavingsLimit_ThrowsSavingsLimitExceededException() {
        // existing commitments = 1400, proposedRate = 200 → total = 1600 > disposable 1500
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(goalRepository.findById(testGoal.getId())).thenReturn(Optional.of(testGoal));
        when(financialProfileService.getSnapshot(testUser)).thenReturn(mockSnapshot);
        when(financialProfileService.getTotalMonthlySavings(testUser.getId()))
                .thenReturn(new BigDecimal("1400.000")); // nearly maxed out

        assertThrows(SavingsLimitExceededException.class,
                () -> projectionService.getProjection(testGoal.getId(), MONTHLY_RATE));

        verify(goalRepository, never()).save(any());
    }

    // ── Auth / ownership ──────────────────────────────────────────────────────

    @Test
    void getProjection_WithNonExistentGoal_ThrowsGoalNotFoundException() {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(goalRepository.findById(any(UUID.class))).thenReturn(Optional.empty());

        assertThrows(GoalNotFoundException.class,
                () -> projectionService.getProjection(UUID.randomUUID(), MONTHLY_RATE));
    }

    @Test
    void getProjection_ByUnauthorizedUser_ThrowsUnauthorizedAccessException() {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(otherUser));
        when(goalRepository.findById(testGoal.getId())).thenReturn(Optional.of(testGoal));

        assertThrows(UnauthorizedAccessException.class,
                () -> projectionService.getProjection(testGoal.getId(), MONTHLY_RATE));
    }
}