package com.pathwise.backend.service;

import com.pathwise.backend.dto.ProjectionResponse;
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
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ProjectionService {

    private final GoalRepository goalRepository;
    private final UserRepository userRepository;
    private final FinancialProfileService financialProfileService;

    /**
     * Called by ProjectionController as:
     *   projectionService.getProjection(id, request.getMonthlySavingsRate())
     */
    public ProjectionResponse getProjection(UUID goalId, BigDecimal monthlySavingsRate) {
        User user = getCurrentUser();
        Goal goal = getOwnedGoal(user, goalId);
        FinancialSnapshot snap = financialProfileService.getSnapshot(user);

        BigDecimal remaining = goal.getTargetAmount().subtract(goal.getSavedAmount());

        // ── Core projection math ──────────────────────────────────────────────
        long monthsNeeded = remaining
                .divide(monthlySavingsRate, 0, RoundingMode.CEILING)
                .longValue();

        LocalDate projectedDate      = LocalDate.now().plusMonths(monthsNeeded);
        boolean   isOnTrack          = !projectedDate.isAfter(goal.getDeadline());
        long      monthsAheadOrBehind = ChronoUnit.MONTHS.between(projectedDate, goal.getDeadline());

        // ── Chart: monthly cumulative savings curve ───────────────────────────
        List<ProjectionResponse.ChartPoint> chart = new ArrayList<>();
        BigDecimal cumulative = goal.getSavedAmount();
        int points = (int) Math.min(monthsNeeded + 1, 37);
        for (int i = 0; i < points; i++) {
            chart.add(new ProjectionResponse.ChartPoint(
                    LocalDate.now().plusMonths(i).toString(),
                    cumulative.min(goal.getTargetAmount())));
            cumulative = cumulative.add(monthlySavingsRate);
        }

        // ── Affordability note ────────────────────────────────────────────────
        BigDecimal remainingDisposable = snap.disposableIncome().subtract(monthlySavingsRate);
        String affordabilityNote;
        if (remainingDisposable.compareTo(BigDecimal.ZERO) < 0) {
            affordabilityNote = String.format(
                    "BD %.2f/month for this goal alone exceeds your disposable income of BD %.2f. " +
                            "Consider a lower monthly target or a later deadline.",
                    monthlySavingsRate, snap.disposableIncome());
        } else {
            affordabilityNote = String.format(
                    "After saving BD %.2f/month for this goal, you would have BD %.2f left " +
                            "from your disposable income (before other goal commitments).",
                    monthlySavingsRate, remainingDisposable);
        }

        // Persist the chosen rate back to the goal
        goal.setMonthlySavingsTarget(monthlySavingsRate);
        goal.setStatus(isOnTrack ? GoalStatus.ON_TRACK : GoalStatus.AT_RISK);
        goal.setUpdatedAt(java.time.LocalDateTime.now());
        goalRepository.save(goal);

        return ProjectionResponse.builder()
                .goalId(goalId)
                .goalName(goal.getName())
                .targetAmount(goal.getTargetAmount())
                .savedAmount(goal.getSavedAmount())
                .monthlySavingsTarget(monthlySavingsRate)
                .monthsNeeded(monthsNeeded)
                .projectedCompletionDate(projectedDate)
                .goalDeadline(goal.getDeadline())
                .isOnTrack(isOnTrack)
                .monthsAheadOrBehind(monthsAheadOrBehind)
                .chartData(chart)
                .monthlySalary(snap.salary())
                .disposableIncome(snap.disposableIncome())
                .remainingAfterThisSaving(remainingDisposable)
                .totalMonthlyCommitment(snap.totalMonthlySavings())
                .warningLevel(snap.warningLevel().name())
                .warningMessage(snap.warningMessage())
                .affordabilityNote(affordabilityNote)
                .build();
    }

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
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