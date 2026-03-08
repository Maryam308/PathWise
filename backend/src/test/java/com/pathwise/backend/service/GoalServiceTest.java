package com.pathwise.backend.service;

import com.pathwise.backend.config.TestDataFactory;
import com.pathwise.backend.dto.GoalRequest;
import com.pathwise.backend.dto.GoalResponse;
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
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GoalServiceTest {

    @Mock
    private GoalRepository goalRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private FinancialProfileService financialProfileService;

    @InjectMocks
    private GoalService goalService;

    private User testUser;
    private User otherUser;
    private Goal testGoal;
    private GoalRequest goalRequest;
    private FinancialSnapshot mockSnapshot;

    @BeforeEach
    void setUp() {
        // Setup security context
        Authentication auth = mock(Authentication.class);
        when(auth.getName()).thenReturn("test@example.com");
        SecurityContext ctx = mock(SecurityContext.class);
        when(ctx.getAuthentication()).thenReturn(auth);
        SecurityContextHolder.setContext(ctx);

        testUser = TestDataFactory.createTestUser();
        otherUser = TestDataFactory.createOtherUser();
        testGoal = TestDataFactory.createTestGoal(testUser);
        goalRequest = TestDataFactory.createValidGoalRequest();

        mockSnapshot = new FinancialSnapshot(
                new BigDecimal("2000.000"),
                new BigDecimal("500.000"),
                new BigDecimal("1500.000"),
                new BigDecimal("300.000"),
                20.0,
                WarningLevel.NONE,
                ""
        );
    }

    @Test
    void createGoal_WithValidData_ReturnsGoalResponse() {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(goalRepository.save(any(Goal.class))).thenReturn(testGoal);
        when(financialProfileService.getSnapshot(testUser)).thenReturn(mockSnapshot);

        GoalResponse response = goalService.createGoal(goalRequest);

        assertNotNull(response);
        assertEquals("Emergency Fund", response.getName());
        assertEquals(GoalStatus.ON_TRACK, response.getStatus());
        assertEquals(20.0, response.getProgressPercentage());

        verify(goalRepository).save(any(Goal.class));
    }

    @Test
    void createGoal_WithMonthlySavingsTarget_ValidatesLimit() {
        goalRequest.setMonthlySavingsTarget(new BigDecimal("300.000"));

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(financialProfileService.getDisposableIncome(testUser))
                .thenReturn(new BigDecimal("1500.000"));
        when(financialProfileService.getTotalMonthlySavings(testUser.getId()))
                .thenReturn(new BigDecimal("0.000"));
        when(goalRepository.save(any(Goal.class))).thenReturn(testGoal);
        when(financialProfileService.getSnapshot(testUser)).thenReturn(mockSnapshot);

        assertDoesNotThrow(() -> goalService.createGoal(goalRequest));
    }

    @Test
    void createGoal_WhenSavingsExceedsLimit_ThrowsException() {
        goalRequest.setMonthlySavingsTarget(new BigDecimal("2000.000"));

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(financialProfileService.getDisposableIncome(testUser))
                .thenReturn(new BigDecimal("1500.000"));
        when(financialProfileService.getTotalMonthlySavings(testUser.getId()))
                .thenReturn(new BigDecimal("0.000"));

        assertThrows(SavingsLimitExceededException.class,
                () -> goalService.createGoal(goalRequest));

        verify(goalRepository, never()).save(any());
    }

    @Test
    void getAllGoals_ReturnsListOfGoals() {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(goalRepository.findByUserId(testUser.getId())).thenReturn(List.of(testGoal));
        when(financialProfileService.getSnapshot(testUser)).thenReturn(mockSnapshot);

        List<GoalResponse> goals = goalService.getAllGoals();

        assertEquals(1, goals.size());
        assertEquals("Emergency Fund", goals.get(0).getName());
    }

    @Test
    void getGoalById_WithValidId_ReturnsGoal() {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(goalRepository.findById(testGoal.getId())).thenReturn(Optional.of(testGoal));
        when(financialProfileService.getSnapshot(testUser)).thenReturn(mockSnapshot);

        GoalResponse response = goalService.getGoalById(testGoal.getId());

        assertNotNull(response);
        assertEquals(testGoal.getId(), response.getId());
    }

    @Test
    void getGoalById_WithInvalidId_ThrowsException() {
        UUID fakeId = UUID.randomUUID();
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(goalRepository.findById(fakeId)).thenReturn(Optional.empty());

        assertThrows(GoalNotFoundException.class,
                () -> goalService.getGoalById(fakeId));
    }

    @Test
    void updateGoal_WithValidData_UpdatesSuccessfully() {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(goalRepository.findById(testGoal.getId())).thenReturn(Optional.of(testGoal));
        when(goalRepository.save(any(Goal.class))).thenReturn(testGoal);
        when(financialProfileService.getSnapshot(testUser)).thenReturn(mockSnapshot);

        goalRequest.setName("Updated Goal Name");
        GoalResponse response = goalService.updateGoal(testGoal.getId(), goalRequest);

        assertNotNull(response);
        verify(goalRepository).save(any(Goal.class));
    }

    @Test
    void updateGoal_ByDifferentUser_ThrowsException() {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(otherUser));
        when(goalRepository.findById(testGoal.getId())).thenReturn(Optional.of(testGoal));

        assertThrows(UnauthorizedAccessException.class,
                () -> goalService.updateGoal(testGoal.getId(), goalRequest));

        verify(goalRepository, never()).save(any());
    }

    @Test
    void deleteGoal_WithValidId_DeletesSuccessfully() {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(goalRepository.findById(testGoal.getId())).thenReturn(Optional.of(testGoal));

        assertDoesNotThrow(() -> goalService.deleteGoal(testGoal.getId()));
        verify(goalRepository).delete(testGoal);
    }

    @Test
    void deleteGoal_ByDifferentUser_ThrowsException() {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(otherUser));
        when(goalRepository.findById(testGoal.getId())).thenReturn(Optional.of(testGoal));

        assertThrows(UnauthorizedAccessException.class,
                () -> goalService.deleteGoal(testGoal.getId()));

        verify(goalRepository, never()).delete(any());
    }
}
