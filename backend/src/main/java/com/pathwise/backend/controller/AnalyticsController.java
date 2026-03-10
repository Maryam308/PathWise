package com.pathwise.backend.controller;

import com.pathwise.backend.dto.AnalyticsResponse;
import com.pathwise.backend.service.AnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * REST controller for analytics operations.
 * Provides endpoints for retrieving financial analytics data including
 * balance, income, expenses, and spending patterns over time.
 * 
 * @author PathWise Team
 * @version 1.0
 */
@RestController
@RequestMapping("/api/analytics")
@RequiredArgsConstructor
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    /**
     * Retrieves analytics data for the authenticated user.
     * 
     * @param months Number of months to analyze (default: 3)
     * @return AnalyticsResponse containing financial metrics and breakdowns
     */
    @GetMapping
    public ResponseEntity<AnalyticsResponse> getAnalytics(
            @RequestParam(defaultValue = "3") int months) {
        return ResponseEntity.ok(analyticsService.getAnalytics(months));
    }
}