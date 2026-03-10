package com.pathwise.backend.controller;

import com.pathwise.backend.dto.AnomalyResponse;
import com.pathwise.backend.service.AnomalyService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * REST controller for anomaly detection operations.
 * Handles detection, retrieval, and dismissal of spending anomalies.
 * 
 * @author PathWise Team
 * @version 1.0
 */
@RestController
@RequestMapping("/api/anomalies")
@RequiredArgsConstructor
public class AnomalyController {

    private final AnomalyService anomalyService;

    /**
     * Retrieves all active (undismissed) anomalies for the authenticated user.
     * Triggers detection before returning results.
     * 
     * @return List of active anomaly responses
     */
    @GetMapping
    public ResponseEntity<List<AnomalyResponse>> getAnomalies() {
        return ResponseEntity.ok(anomalyService.detectAndGetAnomalies());
    }

    /**
     * Dismisses an anomaly by its ID.
     * 
     * @param id The UUID of the anomaly to dismiss
     * @return Success message
     */
    @PatchMapping("/{id}/dismiss")
    public ResponseEntity<String> dismiss(@PathVariable UUID id) {
        anomalyService.dismissAnomaly(id);
        return ResponseEntity.ok("Anomaly dismissed");
    }
}