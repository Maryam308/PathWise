package com.pathwise.backend.service;

import com.pathwise.backend.dto.GoalRequest;
import com.pathwise.backend.dto.GoalResponse;
import com.pathwise.backend.model.Goal;
import com.pathwise.backend.model.User;
import com.pathwise.backend.enums.GoalStatus;
import com.pathwise.backend.repository.GoalRepository;
import com.pathwise.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GoalService {

    private final GoalRepository goalRepository;
    private final UserRepository userRepository;

    public GoalResponse createGoal(GoalRequest request) {
        User user = userRepository.findById(request.getUserId())
                .orElseThrow(() -> new RuntimeException("User not found"));

        Goal goal = Goal.builder()
                .user(user)
                .name(request.getName())
                .category(request.getCategory())
                .targetAmount(request.getTargetAmount())
                .savedAmount(request.getSavedAmount() != null ? request.getSavedAmount() : BigDecimal.ZERO)
                .currency(request.getCurrency() != null ? request.getCurrency() : "BHD")
                .deadline(request.getDeadline())
                .priority(request.getPriority())
                .status(GoalStatus.ON_TRACK)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        Goal saved = goalRepository.save(goal);
        return toResponse(saved);
    }

    public List<GoalResponse> getAllGoals(UUID userId) {
        return goalRepository.findByUserId(userId)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public GoalResponse getGoalById(UUID id) {
        Goal goal = goalRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Goal not found"));
        return toResponse(goal);
    }

    public GoalResponse updateGoal(UUID id, GoalRequest request) {
        Goal goal = goalRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Goal not found"));

        goal.setName(request.getName());
        goal.setTargetAmount(request.getTargetAmount());
        goal.setSavedAmount(request.getSavedAmount());
        goal.setDeadline(request.getDeadline());
        goal.setPriority(request.getPriority());
        goal.setUpdatedAt(LocalDateTime.now());

        return toResponse(goalRepository.save(goal));
    }

    public void deleteGoal(UUID id) {
        goalRepository.deleteById(id);
    }

    private GoalResponse toResponse(Goal goal) {
        double progress = goal.getSavedAmount().doubleValue() /
                goal.getTargetAmount().doubleValue() * 100;

        return GoalResponse.builder()
                .id(goal.getId())
                .name(goal.getName())
                .category(goal.getCategory())
                .targetAmount(goal.getTargetAmount())
                .savedAmount(goal.getSavedAmount())
                .currency(goal.getCurrency())
                .deadline(goal.getDeadline())
                .priority(goal.getPriority())
                .status(goal.getStatus())
                .progressPercentage(Math.min(progress, 100))
                .createdAt(goal.getCreatedAt())
                .build();
    }
}