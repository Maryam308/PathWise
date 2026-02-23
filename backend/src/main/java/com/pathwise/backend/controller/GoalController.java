package com.pathwise.backend.controller;

import com.pathwise.backend.dto.GoalRequest;
import com.pathwise.backend.dto.GoalResponse;
import com.pathwise.backend.service.GoalService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/goals")
@RequiredArgsConstructor
public class GoalController {

    private final GoalService goalService;

    @PostMapping
    public ResponseEntity<GoalResponse> createGoal(@RequestBody GoalRequest request) {
        return ResponseEntity.ok(goalService.createGoal(request));
    }

    @GetMapping
    public ResponseEntity<List<GoalResponse>> getAllGoals() {
        return ResponseEntity.ok(goalService.getAllGoals());
    }

    @GetMapping("/{id}")
    public ResponseEntity<GoalResponse> getGoal(@PathVariable UUID id) {
        return ResponseEntity.ok(goalService.getGoalById(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<GoalResponse> updateGoal(
            @PathVariable UUID id,
            @RequestBody GoalRequest request) {
        return ResponseEntity.ok(goalService.updateGoal(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteGoal(@PathVariable UUID id) {
        goalService.deleteGoal(id);
        return ResponseEntity.noContent().build();
    }
}