package com.pathwise.backend.controller;

import com.pathwise.backend.service.AICoachService;
import com.pathwise.backend.dto.ChatRequest;
import com.pathwise.backend.dto.ChatResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/ai-coach")
@RequiredArgsConstructor
public class AICoachController {

    private final AICoachService aiCoachService;

    @PostMapping("/chat")
    public ResponseEntity<ChatResponse> chat(@Valid @RequestBody ChatRequest request) {
        return ResponseEntity.ok(aiCoachService.chat(request));
    }

    @GetMapping("/weekly-advice")
    public ResponseEntity<ChatResponse> weeklyAdvice() {
        return ResponseEntity.ok(aiCoachService.getWeeklyAdvice());
    }

    @PostMapping("/context-event")
    public ResponseEntity<Void> contextEvent(@RequestBody Map<String, String> body) {
        String actionType = body.getOrDefault("actionType", "GOAL_ACTION");
        String goalName   = body.getOrDefault("goalName", "your goal");
        aiCoachService.notifyGoalAction(actionType, goalName);
        return ResponseEntity.ok().build();
    }
}