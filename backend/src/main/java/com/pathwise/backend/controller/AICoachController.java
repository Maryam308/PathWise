package com.pathwise.backend.controller;

import com.pathwise.backend.service.AICoachService;
import com.pathwise.backend.dto.ChatRequest;
import com.pathwise.backend.dto.ChatResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AICoachController {

    private final AICoachService aiCoachService;

    /** Main chat endpoint */
    @PostMapping("/chat")
    public ResponseEntity<ChatResponse> chat(@RequestBody ChatRequest request) {
        return ResponseEntity.ok(aiCoachService.chat(request));
    }

    /** Weekly check-in */
    @GetMapping("/weekly-advice")
    public ResponseEntity<ChatResponse> weeklyAdvice() {
        return ResponseEntity.ok(aiCoachService.getWeeklyAdvice());
    }

    /**
     * Called by the frontend wizard after a goal is created/updated/deleted.
     * Injects a context-reset into conversation history so the next user
     * message isn't treated as a continuation of the wizard task.
     *
     * Body: { "actionType": "CREATE_GOAL", "goalName": "Japan" }
     */
    @PostMapping("/context-event")
    public ResponseEntity<Void> contextEvent(@RequestBody Map<String, String> body) {
        String actionType = body.getOrDefault("actionType", "GOAL_ACTION");
        String goalName   = body.getOrDefault("goalName", "your goal");
        aiCoachService.notifyGoalAction(actionType, goalName);
        return ResponseEntity.ok().build();
    }
}