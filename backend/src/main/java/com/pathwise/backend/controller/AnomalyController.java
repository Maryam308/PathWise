package com.pathwise.backend.controller;

import com.pathwise.backend.dto.AnomalyResponse;
import com.pathwise.backend.service.AnomalyService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/anomalies")
@RequiredArgsConstructor
public class AnomalyController {

    private final AnomalyService anomalyService;

    // Detect and return active anomalies
    @GetMapping
    public ResponseEntity<List<AnomalyResponse>> getAnomalies() {
        return ResponseEntity.ok(anomalyService.detectAndGetAnomalies());
    }

    // Dismiss an anomaly
    @PatchMapping("/{id}/dismiss")
    public ResponseEntity<String> dismiss(@PathVariable UUID id) {
        anomalyService.dismissAnomaly(id);
        return ResponseEntity.ok("Anomaly dismissed");
    }
}