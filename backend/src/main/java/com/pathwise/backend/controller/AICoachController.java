package com.pathwise.backend.controller;

import com.pathwise.backend.dto.ChatRequest;
import com.pathwise.backend.dto.ChatResponse;
import com.pathwise.backend.service.AICoachService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AICoachController {

    private final AICoachService aiCoachService;

    @PostMapping("/chat")
    public ResponseEntity<ChatResponse> chat(
            @Valid @RequestBody ChatRequest request) {
        return ResponseEntity.ok(aiCoachService.chat(request));
    }

    @GetMapping("/advice")
    public ResponseEntity<ChatResponse> getWeeklyAdvice() {
        return ResponseEntity.ok(aiCoachService.getWeeklyAdvice());
    }
}