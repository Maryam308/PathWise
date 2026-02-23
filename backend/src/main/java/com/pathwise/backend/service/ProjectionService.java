package com.pathwise.backend.service;

import com.pathwise.backend.dto.ProjectionResponse;
import com.pathwise.backend.exception.GoalNotFoundException;
import com.pathwise.backend.exception.UnauthorizedAccessException;
import com.pathwise.backend.exception.UserNotFoundException;
import com.pathwise.backend.model.Goal;
import com.pathwise.backend.model.User;
import com.pathwise.backend.repository.GoalRepository;
import com.pathwise.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ProjectionService {

    private final GoalRepository goalRepository;
    private final UserRepository userRepository;

    private User getCurrentUser() {
        UserDetails userDetails = (UserDetails) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        return userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new UserNotFoundException("User not found"));
    }

    public ProjectionResponse getProjection(UUID goalId, BigDecimal monthlySavingsRate) {
        User currentUser = getCurrentUser();

        Goal goal = goalRepository.findById(goalId)
                .orElseThrow(() -> new GoalNotFoundException("Goal not found with id: " + goalId));

        if (!goal.getUser().getId().equals(currentUser.getId())) {
            throw new UnauthorizedAccessException("You don't have permission to view this goal");
        }

        // Core math
        BigDecimal remaining = goal.getTargetAmount()
                .subtract(goal.getSavedAmount())
                .setScale(3, RoundingMode.HALF_UP);

        // Avoid division by zero
        if (monthlySavingsRate.compareTo(BigDecimal.ZERO) <= 0) {
            monthlySavingsRate = BigDecimal.ONE;
        }

        int monthsToGoal = remaining
                .divide(monthlySavingsRate, 0, RoundingMode.CEILING)
                .intValue();

        LocalDate today = LocalDate.now();
        LocalDate projectedDate = today.plusMonths(monthsToGoal);
        LocalDate deadline = goal.getDeadline();

        // Are they on track?
        boolean onTrack = !projectedDate.isAfter(deadline);

        // How many months ahead or behind?
        long deadlineMonths = java.time.temporal.ChronoUnit.MONTHS.between(today, deadline);
        int monthsAheadOrBehind = (int) (deadlineMonths - monthsToGoal);

        // Build chart data (monthly projection points)
        List<ProjectionResponse.ProjectionDataPoint> chartData =
                buildChartData(goal, monthlySavingsRate, monthsToGoal);

        return ProjectionResponse.builder()
                .targetAmount(goal.getTargetAmount())
                .savedAmount(goal.getSavedAmount())
                .remainingAmount(remaining)
                .monthlySavingsRate(monthlySavingsRate)
                .monthsToGoal(monthsToGoal)
                .projectedCompletionDate(projectedDate)
                .deadline(deadline)
                .onTrack(onTrack)
                .monthsAheadOrBehind(monthsAheadOrBehind)
                .chartData(chartData)
                .build();
    }

    private List<ProjectionResponse.ProjectionDataPoint> buildChartData(
            Goal goal,
            BigDecimal monthlySavingsRate,
            int monthsToGoal) {

        List<ProjectionResponse.ProjectionDataPoint> points = new ArrayList<>();
        LocalDate date = LocalDate.now();
        BigDecimal currentSavings = goal.getSavedAmount();
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("MMM yyyy");

        // Show max 24 months on chart
        int months = Math.min(monthsToGoal + 3, 24);

        for (int i = 0; i <= months; i++) {
            points.add(ProjectionResponse.ProjectionDataPoint.builder()
                    .month(date.format(formatter))
                    .projectedSavings(currentSavings.min(goal.getTargetAmount())
                            .setScale(3, RoundingMode.HALF_UP))
                    .targetLine(goal.getTargetAmount())
                    .build());

            currentSavings = currentSavings.add(monthlySavingsRate);
            date = date.plusMonths(1);
        }

        return points;
    }
}