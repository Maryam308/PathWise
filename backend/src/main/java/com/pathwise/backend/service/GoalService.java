package com.pathwise.backend.service;

import com.pathwise.backend.dto.GoalRequest;
import com.pathwise.backend.dto.GoalResponse;
import com.pathwise.backend.enums.GoalStatus;
import com.pathwise.backend.exception.GoalNotFoundException;
import com.pathwise.backend.exception.UnauthorizedAccessException;
import com.pathwise.backend.model.Goal;
import com.pathwise.backend.model.User;
import com.pathwise.backend.repository.GoalRepository;
import com.pathwise.backend.repository.UserRepository;
import com.pathwise.backend.service.FinancialProfileService.FinancialSnapshot;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GoalService {

    private final GoalRepository goalRepository;
    private final UserRepository userRepository;
    private final FinancialProfileService financialProfileService;

    // ── Create ────────────────────────────────────────────────────────────────

    public GoalResponse createGoal(GoalRequest request) {
        User user = getCurrentUser();

        Goal goal = Goal.builder()
                .user(user)
                .name(request.getName())
                .category(request.getCategory())
                .targetAmount(request.getTargetAmount())
                .savedAmount(request.getSavedAmount() != null
                        ? request.getSavedAmount() : BigDecimal.ZERO)
                .monthlySavingsTarget(request.getMonthlySavingsTarget())
                .currency(request.getCurrency() != null ? request.getCurrency() : "BHD")
                .deadline(request.getDeadline())
                .priority(request.getPriority())
                .status(GoalStatus.ON_TRACK)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        return toResponse(goalRepository.save(goal), user);
    }

    // ── Read ──────────────────────────────────────────────────────────────────

    public List<GoalResponse> getAllGoals() {
        User user = getCurrentUser();
        return goalRepository.findByUserId(user.getId()).stream()
                .map(g -> toResponse(g, user))
                .collect(Collectors.toList());
    }

    public GoalResponse getGoalById(UUID goalId) {
        User user = getCurrentUser();
        Goal goal = getOwnedGoal(user, goalId);
        return toResponse(goal, user);
    }

    // ── Update ────────────────────────────────────────────────────────────────

    public GoalResponse updateGoal(UUID goalId, GoalRequest request) {
        User user = getCurrentUser();
        Goal goal = getOwnedGoal(user, goalId);

        goal.setName(request.getName());
        goal.setCategory(request.getCategory());
        goal.setTargetAmount(request.getTargetAmount());
        goal.setPriority(request.getPriority());
        goal.setDeadline(request.getDeadline());
        if (request.getCurrency() != null)
            goal.setCurrency(request.getCurrency());
        if (request.getSavedAmount() != null)
            goal.setSavedAmount(request.getSavedAmount());
        if (request.getMonthlySavingsTarget() != null)
            goal.setMonthlySavingsTarget(request.getMonthlySavingsTarget());

        goal.setStatus(calculateStatus(goal));
        goal.setUpdatedAt(LocalDateTime.now());

        return toResponse(goalRepository.save(goal), user);
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    public void deleteGoal(UUID goalId) {
        User user = getCurrentUser();
        goalRepository.delete(getOwnedGoal(user, goalId));
    }

    // ── Status Calculation ────────────────────────────────────────────────────

    private GoalStatus calculateStatus(Goal goal) {
        // Already reached target
        if (goal.getSavedAmount().compareTo(goal.getTargetAmount()) >= 0)
            return GoalStatus.COMPLETED;

        // No monthly target set yet — can't project, assume ON_TRACK
        if (goal.getMonthlySavingsTarget() == null
                || goal.getMonthlySavingsTarget().compareTo(BigDecimal.ZERO) <= 0)
            return GoalStatus.ON_TRACK;

        BigDecimal remaining = goal.getTargetAmount().subtract(goal.getSavedAmount());
        long months = remaining
                .divide(goal.getMonthlySavingsTarget(), 0, RoundingMode.CEILING)
                .longValue();

        return LocalDate.now().plusMonths(months).isAfter(goal.getDeadline())
                ? GoalStatus.AT_RISK
                : GoalStatus.ON_TRACK;
    }

    // ── Mapping ───────────────────────────────────────────────────────────────

    private GoalResponse toResponse(Goal goal, User user) {
        double progress = 0.0;
        if (goal.getTargetAmount().compareTo(BigDecimal.ZERO) > 0) {
            progress = Math.round(
                    goal.getSavedAmount()
                            .divide(goal.getTargetAmount(), 4, RoundingMode.HALF_UP)
                            .multiply(BigDecimal.valueOf(100))
                            .doubleValue() * 10.0) / 10.0;
        }

        FinancialSnapshot snap = financialProfileService.getSnapshot(user);

        return GoalResponse.builder()
                .id(goal.getId())
                .name(goal.getName())
                .category(goal.getCategory())
                .targetAmount(goal.getTargetAmount())
                .savedAmount(goal.getSavedAmount())
                .monthlySavingsTarget(goal.getMonthlySavingsTarget())
                .currency(goal.getCurrency())
                .deadline(goal.getDeadline())
                .priority(goal.getPriority())
                .status(goal.getStatus())
                .progressPercentage(progress)
                .monthlySalary(snap.salary())
                .totalMonthlyExpenses(snap.totalExpenses())
                .disposableIncome(snap.disposableIncome())
                .totalMonthlyCommitment(snap.totalMonthlySavings())
                .savingsRatePercent(snap.savingsRatePercent())
                .warningLevel(snap.warningLevel().name())
                .warningMessage(snap.warningMessage())
                .createdAt(goal.getCreatedAt())
                .updatedAt(goal.getUpdatedAt())
                .build();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext()
                .getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Authenticated user not found"));
    }

    private Goal getOwnedGoal(User user, UUID goalId) {
        Goal goal = goalRepository.findById(goalId)
                .orElseThrow(() -> new GoalNotFoundException("Goal not found: " + goalId));
        if (!goal.getUser().getId().equals(user.getId()))
            throw new UnauthorizedAccessException("You do not have access to this goal");
        return goal;
    }
}