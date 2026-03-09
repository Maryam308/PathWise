package com.pathwise.backend.service;

import com.pathwise.backend.config.TestDataFactory;
import com.pathwise.backend.dto.GoalRequest;
import com.pathwise.backend.dto.GoalResponse;
import com.pathwise.backend.enums.GoalCategory;
import com.pathwise.backend.enums.GoalPriority;
import com.pathwise.backend.enums.GoalStatus;
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
import java.time.YearMonth;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GoalServiceTest {

    @Mock private GoalRepository           goalRepository;
    @Mock private UserRepository           userRepository;
    @Mock private FinancialProfileService  financialProfileService;

    @InjectMocks
    private GoalService goalService;

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

    // ── createGoal ────────────────────────────────────────────────────────────

    @Test
    void createGoal_WithValidRequest_ReturnsGoalResponse() {
        GoalRequest request = TestDataFactory.createValidGoalRequest();
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(goalRepository.save(any(Goal.class))).thenReturn(testGoal);
        when(financialProfileService.getSnapshot(testUser)).thenReturn(mockSnapshot);

        GoalResponse response = goalService.createGoal(request);

        assertNotNull(response);
        assertEquals("Emergency Fund", response.getName());
        verify(goalRepository).save(any(Goal.class));
    }

    @Test
    void createGoal_WithMonthlySavingsTarget_ChecksLimitBeforeSaving() {
        GoalRequest request = TestDataFactory.createValidGoalRequest();
        request.setMonthlySavingsTarget(new BigDecimal("200.000"));

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(financialProfileService.getDisposableIncome(testUser))
                .thenReturn(new BigDecimal("1500.000"));
        when(financialProfileService.getTotalMonthlySavings(testUser.getId()))
                .thenReturn(BigDecimal.ZERO);
        when(goalRepository.save(any(Goal.class))).thenReturn(testGoal);
        when(financialProfileService.getSnapshot(testUser)).thenReturn(mockSnapshot);

        GoalResponse response = goalService.createGoal(request);

        assertNotNull(response);
        verify(financialProfileService).getDisposableIncome(testUser);
        verify(financialProfileService).getTotalMonthlySavings(testUser.getId());
    }

    @Test
    void createGoal_WhenSavingsLimitExceeded_ThrowsSavingsLimitExceededException() {
        GoalRequest request = TestDataFactory.createValidGoalRequest();
        request.setMonthlySavingsTarget(new BigDecimal("2000.000")); // exceeds disposable

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(financialProfileService.getDisposableIncome(testUser))
                .thenReturn(new BigDecimal("1500.000"));
        when(financialProfileService.getTotalMonthlySavings(testUser.getId()))
                .thenReturn(BigDecimal.ZERO);

        assertThrows(SavingsLimitExceededException.class,
                () -> goalService.createGoal(request));

        verify(goalRepository, never()).save(any());
    }

    @Test
    void createGoal_WithNullSavedAmount_DefaultsToZero() {
        GoalRequest request = TestDataFactory.createValidGoalRequest();
        request.setSavedAmount(null);

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(goalRepository.save(any(Goal.class))).thenAnswer(inv -> {
            Goal saved = inv.getArgument(0);
            assertEquals(BigDecimal.ZERO, saved.getSavedAmount());
            return testGoal;
        });
        when(financialProfileService.getSnapshot(testUser)).thenReturn(mockSnapshot);

        goalService.createGoal(request);
    }

    @Test
    void createGoal_TrimsWhitespaceFromName() {
        GoalRequest request = TestDataFactory.createValidGoalRequest();
        request.setName("  Emergency Fund  ");

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(goalRepository.save(any(Goal.class))).thenAnswer(inv -> {
            Goal saved = inv.getArgument(0);
            assertEquals("Emergency Fund", saved.getName());
            return testGoal;
        });
        when(financialProfileService.getSnapshot(testUser)).thenReturn(mockSnapshot);

        goalService.createGoal(request);
    }

    // ── getAllGoals ────────────────────────────────────────────────────────────

    @Test
    void getAllGoals_ReturnsGoalsForCurrentUser() {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(goalRepository.findByUserId(testUser.getId())).thenReturn(List.of(testGoal));
        when(financialProfileService.getSnapshot(testUser)).thenReturn(mockSnapshot);

        List<GoalResponse> responses = goalService.getAllGoals();

        assertEquals(1, responses.size());
        assertEquals("Emergency Fund", responses.get(0).getName());
    }

    @Test
    void getAllGoals_WhenNoGoals_ReturnsEmptyList() {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(goalRepository.findByUserId(testUser.getId())).thenReturn(List.of());

        List<GoalResponse> responses = goalService.getAllGoals();

        assertTrue(responses.isEmpty());
    }

    // ── getGoalById ───────────────────────────────────────────────────────────

    @Test
    void getGoalById_WithValidId_ReturnsGoalResponse() {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(goalRepository.findById(testGoal.getId())).thenReturn(Optional.of(testGoal));
        when(financialProfileService.getSnapshot(testUser)).thenReturn(mockSnapshot);

        GoalResponse response = goalService.getGoalById(testGoal.getId());

        assertEquals(testGoal.getId(), response.getId());
    }

    @Test
    void getGoalById_WithNonExistentId_ThrowsGoalNotFoundException() {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(goalRepository.findById(any(UUID.class))).thenReturn(Optional.empty());

        assertThrows(GoalNotFoundException.class,
                () -> goalService.getGoalById(UUID.randomUUID()));
    }

    @Test
    void getGoalById_WithOtherUsersGoal_ThrowsUnauthorizedAccessException() {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(otherUser));
        when(goalRepository.findById(testGoal.getId())).thenReturn(Optional.of(testGoal));

        assertThrows(UnauthorizedAccessException.class,
                () -> goalService.getGoalById(testGoal.getId()));
    }

    // ── updateGoal ────────────────────────────────────────────────────────────

    @Test
    void updateGoal_WithValidData_UpdatesAndReturnsResponse() {
        GoalRequest request = TestDataFactory.createValidGoalRequest();
        request.setName("Updated Fund");

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(goalRepository.findById(testGoal.getId())).thenReturn(Optional.of(testGoal));
        when(goalRepository.save(any(Goal.class))).thenReturn(testGoal);
        when(financialProfileService.getSnapshot(testUser)).thenReturn(mockSnapshot);

        GoalResponse response = goalService.updateGoal(testGoal.getId(), request);

        assertNotNull(response);
        verify(goalRepository).save(any(Goal.class));
    }

    @Test
    void updateGoal_WithOtherUsersGoal_ThrowsUnauthorizedAccessException() {
        GoalRequest request = TestDataFactory.createValidGoalRequest();

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(otherUser));
        when(goalRepository.findById(testGoal.getId())).thenReturn(Optional.of(testGoal));

        assertThrows(UnauthorizedAccessException.class,
                () -> goalService.updateGoal(testGoal.getId(), request));

        verify(goalRepository, never()).save(any());
    }

    @Test
    void updateGoal_WithNewSavingsTarget_ValidatesAgainstLimit() {
        GoalRequest request = TestDataFactory.createValidGoalRequest();
        request.setMonthlySavingsTarget(new BigDecimal("300.000"));

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(goalRepository.findById(testGoal.getId())).thenReturn(Optional.of(testGoal));
        when(financialProfileService.getDisposableIncome(testUser))
                .thenReturn(new BigDecimal("1500.000"));
        when(financialProfileService.getTotalMonthlySavings(testUser.getId()))
                .thenReturn(BigDecimal.ZERO);
        when(goalRepository.save(any(Goal.class))).thenReturn(testGoal);
        when(financialProfileService.getSnapshot(testUser)).thenReturn(mockSnapshot);

        goalService.updateGoal(testGoal.getId(), request);

        verify(financialProfileService).getDisposableIncome(testUser);
    }

    // ── deleteGoal ────────────────────────────────────────────────────────────

    @Test
    void deleteGoal_WithValidId_DeletesGoal() {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(goalRepository.findById(testGoal.getId())).thenReturn(Optional.of(testGoal));

        goalService.deleteGoal(testGoal.getId());

        verify(goalRepository).delete(testGoal);
    }

    @Test
    void deleteGoal_WithOtherUsersGoal_ThrowsUnauthorizedAccessException() {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(otherUser));
        when(goalRepository.findById(testGoal.getId())).thenReturn(Optional.of(testGoal));

        assertThrows(UnauthorizedAccessException.class,
                () -> goalService.deleteGoal(testGoal.getId()));

        verify(goalRepository, never()).delete(any());
    }

    @Test
    void deleteGoal_WithNonExistentId_ThrowsGoalNotFoundException() {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(goalRepository.findById(any(UUID.class))).thenReturn(Optional.empty());

        assertThrows(GoalNotFoundException.class,
                () -> goalService.deleteGoal(UUID.randomUUID()));
    }

    // ── Progress calculation ──────────────────────────────────────────────────

    @Test
    void getGoalById_CalculatesProgressPercentageCorrectly() {
        // saved=1000, target=5000 → 20.0%
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(goalRepository.findById(testGoal.getId())).thenReturn(Optional.of(testGoal));
        when(financialProfileService.getSnapshot(testUser)).thenReturn(mockSnapshot);

        GoalResponse response = goalService.getGoalById(testGoal.getId());

        assertEquals(20.0, response.getProgressPercentage());
    }

    @Test
    void createGoal_StatusDefaultsToOnTrack() {
        GoalRequest request = TestDataFactory.createValidGoalRequest();

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(goalRepository.save(any(Goal.class))).thenAnswer(inv -> {
            Goal saved = inv.getArgument(0);
            assertEquals(GoalStatus.ON_TRACK, saved.getStatus());
            return testGoal;
        });
        when(financialProfileService.getSnapshot(testUser)).thenReturn(mockSnapshot);

        goalService.createGoal(request);
    }

    // ── getFinancialSnapshot ──────────────────────────────────────────────────

    @Test
    void getFinancialSnapshot_ReturnsSnapshotForCurrentUser() {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(financialProfileService.getSnapshot(testUser)).thenReturn(mockSnapshot);

        FinancialSnapshot snapshot = goalService.getFinancialSnapshot();

        assertEquals(new BigDecimal("2000.000"), snapshot.salary());
        assertEquals(new BigDecimal("1500.000"), snapshot.disposableIncome());
    }
}