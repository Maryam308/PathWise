package com.pathwise.backend.controller;

import com.pathwise.backend.dto.AnalyticsResponse;
import com.pathwise.backend.service.AnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/analytics")
@RequiredArgsConstructor
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    @GetMapping
    public ResponseEntity<AnalyticsResponse> getAnalytics(
            @RequestParam(defaultValue = "3") int months) {
        return ResponseEntity.ok(analyticsService.getAnalytics(months));
    }
}