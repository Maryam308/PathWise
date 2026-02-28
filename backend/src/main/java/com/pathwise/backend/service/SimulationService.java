package com.pathwise.backend.service;

import com.pathwise.backend.dto.SimulationRequest;
import com.pathwise.backend.dto.SimulationResponse;
import com.pathwise.backend.exception.GoalNotFoundException;
import com.pathwise.backend.exception.UnauthorizedAccessException;
import com.pathwise.backend.exception.UserNotFoundException;
import com.pathwise.backend.model.Goal;
import com.pathwise.backend.model.Simulation;
import com.pathwise.backend.model.User;
import com.pathwise.backend.repository.GoalRepository;
import com.pathwise.backend.repository.SimulationRepository;
import com.pathwise.backend.repository.UserRepository;
import com.pathwise.backend.service.FinancialProfileService.FinancialSnapshot;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SimulationService {

    private final GoalRepository       goalRepository;
    private final UserRepository       userRepository;
    private final SimulationRepository simulationRepository;
    private final FinancialProfileService financialProfileService;

    public SimulationResponse simulate(SimulationRequest request) {
        User user = getCurrentUser();
        Goal goal = getOwnedGoal(user, request.getGoalId());
        FinancialSnapshot snap = financialProfileService.getSnapshot(user);

        BigDecimal currentMonthly = request.getCurrentMonthlySavingsTarget();
        BigDecimal savedAmount    = goal.getSavedAmount() != null
                ? goal.getSavedAmount() : BigDecimal.ZERO;
        BigDecimal remaining      = goal.getTargetAmount().subtract(savedAmount);

        if (remaining.compareTo(BigDecimal.ZERO) < 0) remaining = BigDecimal.ZERO;

        // ── Baseline ──────────────────────────────────────────────────────────
        long      baselineMonths = ceildiv(remaining, currentMonthly);
        LocalDate baselineDate   = LocalDate.now().plusMonths(baselineMonths);

        // ── Simulated ─────────────────────────────────────────────────────────
        // adjustments = { "FOOD": 80.00, "TRANSPORT": 50.00 }
        // Each value = BD freed up per month by cutting that category.
        BigDecimal totalAdjustment = request.getSpendingAdjustments().values().stream()
                .filter(v -> v != null && v.compareTo(BigDecimal.ZERO) > 0)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal simulatedMonthly = currentMonthly.add(totalAdjustment);
        long       simulatedMonths  = ceildiv(remaining, simulatedMonthly);
        LocalDate  simulatedDate    = LocalDate.now().plusMonths(simulatedMonths);
        long       monthsSaved      = baselineMonths - simulatedMonths;

        // ── Affordability context ─────────────────────────────────────────────
        BigDecimal remainingDisposable = snap.disposableIncome().subtract(simulatedMonthly);
        String affordabilityNote;
        if (remainingDisposable.compareTo(BigDecimal.ZERO) < 0) {
            affordabilityNote = String.format(
                    "Warning: the simulated rate of BD %.3f/month would exceed your disposable " +
                            "income of BD %.3f. This is a theoretical scenario.",
                    simulatedMonthly, snap.disposableIncome());
        } else {
            affordabilityNote = String.format(
                    "With these cuts, you would save BD %.3f/month and have BD %.3f remaining " +
                            "from your disposable income for day-to-day spending.",
                    simulatedMonthly, remainingDisposable);
        }

        // ── Chart data ────────────────────────────────────────────────────────
        int chartLen = (int) Math.min(baselineMonths + 1, 37);
        List<SimulationResponse.ChartPoint> baselineChart  = new ArrayList<>();
        List<SimulationResponse.ChartPoint> simulatedChart = new ArrayList<>();
        BigDecimal bCum = savedAmount;
        BigDecimal sCum = savedAmount;
        for (int i = 0; i < chartLen; i++) {
            String month = LocalDate.now().plusMonths(i).toString();
            baselineChart .add(new SimulationResponse.ChartPoint(month, bCum.min(goal.getTargetAmount())));
            simulatedChart.add(new SimulationResponse.ChartPoint(month, sCum.min(goal.getTargetAmount())));
            bCum = bCum.add(currentMonthly);
            sCum = sCum.add(simulatedMonthly);
        }

        // ── Persist simulation ────────────────────────────────────────────────
        simulationRepository.save(Simulation.builder()
                .goal(goal)
                .user(user)
                .monthlyContribution(simulatedMonthly)
                .projectedCompletionDate(simulatedDate)
                .createdAt(LocalDateTime.now())
                .build());

        return SimulationResponse.builder()
                .goalId(goal.getId()).goalName(goal.getName())
                .targetAmount(goal.getTargetAmount()).savedAmount(savedAmount)
                .currentMonthlySavingsTarget(currentMonthly)
                .baselineCompletionDate(baselineDate).baselineMonths(baselineMonths)
                .spendingAdjustments(request.getSpendingAdjustments())
                .totalAdjustment(totalAdjustment)
                .simulatedMonthlySavingsTarget(simulatedMonthly)
                .simulatedCompletionDate(simulatedDate).simulatedMonths(simulatedMonths)
                .monthsSaved(monthsSaved)
                .baselineChart(baselineChart).simulatedChart(simulatedChart)
                .disposableIncome(snap.disposableIncome())
                .remainingDisposableAfterSimulation(remainingDisposable)
                .affordabilityNote(affordabilityNote)
                .warningLevel(snap.warningLevel().name())
                .build();
    }

    public List<SimulationResponse> getSavedSimulations(UUID goalId) {
        User user = getCurrentUser();
        getOwnedGoal(user, goalId); // ownership check

        return simulationRepository.findByGoalId(goalId).stream()
                .map(s -> SimulationResponse.builder()
                        .goalId(goalId)
                        .simulatedMonthlySavingsTarget(s.getMonthlyContribution())
                        .simulatedCompletionDate(s.getProjectedCompletionDate())
                        .build())
                .collect(Collectors.toList());
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private long ceildiv(BigDecimal num, BigDecimal den) {
        if (num.compareTo(BigDecimal.ZERO) == 0) return 0;
        return num.divide(den, 0, RoundingMode.CEILING).longValue();
    }

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