package com.pathwise.backend.service;

import com.pathwise.backend.dto.GoalRequest;
import com.pathwise.backend.dto.GoalResponse;
import com.pathwise.backend.enums.GoalStatus;
import com.pathwise.backend.exception.GoalNotFoundException;
import com.pathwise.backend.exception.SavingsLimitExceededException;
import com.pathwise.backend.exception.UnauthorizedAccessException;
import com.pathwise.backend.exception.UserNotFoundException;
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

        // If a monthly savings target is being set on creation, validate it
        // won't push the total past the user's disposable income.
        if (request.getMonthlySavingsTarget() != null
                && request.getMonthlySavingsTarget().compareTo(BigDecimal.ZERO) > 0) {
            checkSavingsLimit(user, null, request.getMonthlySavingsTarget());
        }

        Goal goal = Goal.builder()
                .user(user)
                .name(request.getName().trim())
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
        return toResponse(getOwnedGoal(user, goalId), user);
    }

    // ── Update ────────────────────────────────────────────────────────────────

    public GoalResponse updateGoal(UUID goalId, GoalRequest request) {
        User user = getCurrentUser();
        Goal goal = getOwnedGoal(user, goalId);

        // If the monthly savings target is changing, validate the new total
        // won't exceed the user's disposable income.
        // We pass the goal's current value so it's excluded from the "existing total"
        // calculation (we're replacing it, not adding to it).
        if (request.getMonthlySavingsTarget() != null
                && request.getMonthlySavingsTarget().compareTo(BigDecimal.ZERO) > 0) {
            checkSavingsLimit(user, goal.getMonthlySavingsTarget(), request.getMonthlySavingsTarget());
        }

        goal.setName(request.getName().trim());
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

    // ── Savings limit check ───────────────────────────────────────────────────

    /**
     * Validates that setting a new monthly savings target on a goal will not
     * push the user's TOTAL savings commitment past their disposable income.
     *
     * @param user            the authenticated user
     * @param currentTarget   the goal's existing monthlySavingsTarget (null for new goals,
     *                        or the current value for updates — so we subtract it first)
     * @param proposedTarget  the new target being requested
     *
     * Example:
     *   disposableIncome = BD 1,000
     *   existing total   = BD 600  (across all goals including this one's current BD 200)
     *   proposedTarget   = BD 500
     *   → newTotal = 600 - 200 + 500 = BD 900 → OK (< 1,000)
     *   → newTotal = 600 - 200 + 700 = BD 1,100 → REJECTED (> 1,000)
     */
    private void checkSavingsLimit(User user, BigDecimal currentTarget, BigDecimal proposedTarget) {
        BigDecimal disposable = financialProfileService.getDisposableIncome(user);
        BigDecimal existingTotal = financialProfileService.getTotalMonthlySavings(user.getId());

        // Subtract the current target so we don't double-count it
        BigDecimal currentCommitment = currentTarget != null
                ? existingTotal.subtract(currentTarget)
                : existingTotal;

        BigDecimal newTotal = currentCommitment.add(proposedTarget);

        if (newTotal.compareTo(disposable) > 0) {
            BigDecimal available = disposable.subtract(currentCommitment);
            throw new SavingsLimitExceededException(String.format(
                    "Setting a monthly savings target of BD %.3f would bring your total savings " +
                            "commitment to BD %.3f, which exceeds your disposable income of BD %.3f. " +
                            "The maximum you can allocate to this goal is BD %.3f.",
                    proposedTarget, newTotal, disposable,
                    available.compareTo(BigDecimal.ZERO) > 0 ? available : BigDecimal.ZERO));
        }
    }

    // ── Status calculation ────────────────────────────────────────────────────

    private GoalStatus calculateStatus(Goal goal) {
        if (goal.getSavedAmount() == null) return GoalStatus.ON_TRACK;

        // Already completed
        if (goal.getSavedAmount().compareTo(goal.getTargetAmount()) >= 0)
            return GoalStatus.COMPLETED;

        // No monthly target — can't project, default to ON_TRACK
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

    // ── Response mapping ──────────────────────────────────────────────────────

    private GoalResponse toResponse(Goal goal, User user) {
        double progress = 0.0;
        if (goal.getTargetAmount() != null
                && goal.getTargetAmount().compareTo(BigDecimal.ZERO) > 0
                && goal.getSavedAmount() != null) {
            progress = Math.round(
                    goal.getSavedAmount()
                            .divide(goal.getTargetAmount(), 4, RoundingMode.HALF_UP)
                            .multiply(BigDecimal.valueOf(100))
                            .doubleValue() * 10.0) / 10.0;
            // Clamp to [0, 100]
            progress = Math.max(0.0, Math.min(100.0, progress));
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
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new UserNotFoundException("Authenticated user not found."));
    }

    private Goal getOwnedGoal(User user, UUID goalId) {
        Goal goal = goalRepository.findById(goalId)
                .orElseThrow(() -> new GoalNotFoundException("Goal not found: " + goalId));
        if (!goal.getUser().getId().equals(user.getId()))
            throw new UnauthorizedAccessException("You do not have access to this goal.");
        return goal;
    }
}