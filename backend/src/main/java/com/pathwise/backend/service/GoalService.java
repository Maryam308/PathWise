package com.pathwise.backend.service;

import com.pathwise.backend.exception.GoalNotFoundException;
import com.pathwise.backend.exception.UnauthorizedAccessException;
import com.pathwise.backend.exception.UserNotFoundException;
import com.pathwise.backend.dto.GoalRequest;
import com.pathwise.backend.dto.GoalResponse;
import com.pathwise.backend.model.Goal;
import com.pathwise.backend.model.User;
import com.pathwise.backend.enums.GoalStatus;
import com.pathwise.backend.repository.GoalRepository;
import com.pathwise.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
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

    private User getCurrentUser() {
        UserDetails userDetails = (UserDetails) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        String email = userDetails.getUsername();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new UserNotFoundException("User not found"));
    }

    public GoalResponse createGoal(GoalRequest request) {
        User currentUser = getCurrentUser();

        Goal goal = Goal.builder()
                .user(currentUser)
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

    public List<GoalResponse> getAllGoals() {
        User currentUser = getCurrentUser();
        return goalRepository.findByUserId(currentUser.getId())
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public GoalResponse getGoalById(UUID id) {
        User currentUser = getCurrentUser();
        Goal goal = goalRepository.findById(id)
                .orElseThrow(() -> new GoalNotFoundException("Goal not found with id: " + id));

        if (!goal.getUser().getId().equals(currentUser.getId())) {
            throw new UnauthorizedAccessException("You don't have permission to view this goal");
        }

        return toResponse(goal);
    }

    public GoalResponse updateGoal(UUID id, GoalRequest request) {
        User currentUser = getCurrentUser();
        Goal goal = goalRepository.findById(id)
                .orElseThrow(() -> new GoalNotFoundException("Goal not found with id: " + id));

        if (!goal.getUser().getId().equals(currentUser.getId())) {
            throw new UnauthorizedAccessException("You don't have permission to update this goal");
        }

        goal.setName(request.getName());
        goal.setTargetAmount(request.getTargetAmount());
        goal.setSavedAmount(request.getSavedAmount());
        goal.setDeadline(request.getDeadline());
        goal.setPriority(request.getPriority());
        goal.setUpdatedAt(LocalDateTime.now());

        double progress = goal.getSavedAmount().doubleValue() /
                goal.getTargetAmount().doubleValue() * 100;
        if (progress >= 100) {
            goal.setStatus(GoalStatus.COMPLETED);
        } else if (progress > 0) {
            goal.setStatus(GoalStatus.ON_TRACK);
        }

        return toResponse(goalRepository.save(goal));
    }

    public void deleteGoal(UUID id) {
        User currentUser = getCurrentUser();
        Goal goal = goalRepository.findById(id)
                .orElseThrow(() -> new GoalNotFoundException("Goal not found with id: " + id));

        if (!goal.getUser().getId().equals(currentUser.getId())) {
            throw new UnauthorizedAccessException("You don't have permission to delete this goal");
        }

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