package com.pathwise.backend.service;

import com.pathwise.backend.dto.ProjectionResponse;
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
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SimulationService {

    private final GoalRepository goalRepository;
    private final UserRepository userRepository;
    private final SimulationRepository simulationRepository;

    private User getCurrentUser() {
        UserDetails userDetails = (UserDetails) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        return userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new UserNotFoundException("User not found"));
    }

    public SimulationResponse simulate(SimulationRequest request) {
        User currentUser = getCurrentUser();

        Goal goal = goalRepository.findById(request.getGoalId())
                .orElseThrow(() -> new GoalNotFoundException(
                        "Goal not found with id: " + request.getGoalId()));

        if (!goal.getUser().getId().equals(currentUser.getId())) {
            throw new UnauthorizedAccessException(
                    "You don't have permission to simulate this goal");
        }

        // Validate no negative adjustments
        request.getAdjustments().forEach((category, amount) -> {
            if (amount.compareTo(BigDecimal.ZERO) < 0) {
                throw new IllegalArgumentException(
                        "Adjustment for " + category + " cannot be negative");
            }
        });

        BigDecimal remaining = goal.getTargetAmount()
                .subtract(goal.getSavedAmount())
                .setScale(3, RoundingMode.HALF_UP);

        // Calculate total adjustment from all sliders
        BigDecimal totalAdjustment = request.getAdjustments().values().stream()
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // New savings rate = current + all spending cuts
        BigDecimal newSavingsRate = request.getCurrentMonthlySavingsRate()
                .add(totalAdjustment)
                .setScale(3, RoundingMode.HALF_UP);

        // Protect against zero or negative savings rate
        if (newSavingsRate.compareTo(BigDecimal.ONE) < 0) {
            newSavingsRate = BigDecimal.ONE;
        }

        // Baseline months (original rate)
        int baselineMonths = remaining
                .divide(request.getCurrentMonthlySavingsRate(), 0, RoundingMode.CEILING)
                .intValue();

        // Simulated months (new rate)
        int simulatedMonths = remaining
                .divide(newSavingsRate, 0, RoundingMode.CEILING)
                .intValue();

        int monthsSaved = baselineMonths - simulatedMonths;

        LocalDate today = LocalDate.now();
        LocalDate baselineDate = today.plusMonths(baselineMonths);
        LocalDate simulatedDate = today.plusMonths(simulatedMonths);
        boolean onTrack = !simulatedDate.isAfter(goal.getDeadline());

        // Save simulation to database
        Simulation simulation = Simulation.builder()
                .user(currentUser)
                .goal(goal)
                .name(request.getName() != null ? request.getName() : "Simulation " + LocalDate.now())
                .adjustments(convertAdjustments(request.getAdjustments()))
                .baselineDate(baselineDate)
                .simulatedDate(simulatedDate)
                .monthsSaved(monthsSaved)
                .createdAt(LocalDateTime.now())
                .build();

        simulationRepository.save(simulation);

        // Build chart data for simulated projection
        List<ProjectionResponse.ProjectionDataPoint> chartData =
                buildChartData(goal, newSavingsRate, simulatedMonths);

        return SimulationResponse.builder()
                .name(simulation.getName())
                .originalMonthlySavingsRate(request.getCurrentMonthlySavingsRate())
                .newMonthlySavingsRate(newSavingsRate)
                .totalAdjustment(totalAdjustment)
                .baselineMonthsToGoal(baselineMonths)
                .simulatedMonthsToGoal(simulatedMonths)
                .monthsSaved(monthsSaved)
                .baselineCompletionDate(baselineDate)
                .simulatedCompletionDate(simulatedDate)
                .deadline(goal.getDeadline())
                .onTrack(onTrack)
                .adjustments(request.getAdjustments())
                .chartData(chartData)
                .build();
    }

    public List<SimulationResponse> getSavedSimulations(UUID goalId) {
        User currentUser = getCurrentUser();

        Goal goal = goalRepository.findById(goalId)
                .orElseThrow(() -> new GoalNotFoundException(
                        "Goal not found with id: " + goalId));

        if (!goal.getUser().getId().equals(currentUser.getId())) {
            throw new UnauthorizedAccessException(
                    "You don't have permission to view simulations for this goal");
        }

        return simulationRepository
                .findByUserIdAndGoalId(currentUser.getId(), goalId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private List<ProjectionResponse.ProjectionDataPoint> buildChartData(
            Goal goal,
            BigDecimal savingsRate,
            int monthsToGoal) {

        List<ProjectionResponse.ProjectionDataPoint> points = new ArrayList<>();
        LocalDate date = LocalDate.now();
        BigDecimal currentSavings = goal.getSavedAmount();
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("MMM yyyy");

        int months = Math.min(monthsToGoal + 3, 24);

        for (int i = 0; i <= months; i++) {
            points.add(ProjectionResponse.ProjectionDataPoint.builder()
                    .month(date.format(formatter))
                    .projectedSavings(currentSavings
                            .min(goal.getTargetAmount())
                            .setScale(3, RoundingMode.HALF_UP))
                    .targetLine(goal.getTargetAmount())
                    .build());

            currentSavings = currentSavings.add(savingsRate);
            date = date.plusMonths(1);
        }

        return points;
    }

    private Map<String, Double> convertAdjustments(Map<String, BigDecimal> adjustments) {
        Map<String, Double> result = new HashMap<>();
        adjustments.forEach((k, v) -> result.put(k, v.doubleValue()));
        return result;
    }

    private SimulationResponse toResponse(Simulation simulation) {
        return SimulationResponse.builder()
                .name(simulation.getName())
                .baselineCompletionDate(simulation.getBaselineDate())
                .simulatedCompletionDate(simulation.getSimulatedDate())
                .monthsSaved(simulation.getMonthsSaved())
                .build();
    }
}