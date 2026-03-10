package com.pathwise.backend.controller;

import com.pathwise.backend.model.Report;
import com.pathwise.backend.service.ReportService;
import com.pathwise.backend.service.ReportService.ReportSummary;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * REST controller for financial report operations.
 * Handles report generation, retrieval, and history listing.
 * 
 * @author PathWise Team
 * @version 1.0
 */
@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;

    /**
     * Generates a new financial report for the authenticated user.
     * This is a manual trigger; 
     * 
     * @return Generated report
     */
    @PostMapping("/generate")
    public ResponseEntity<Report> generateReport() {
        return ResponseEntity.ok(reportService.generateReport());
    }

    /**
     * Retrieves the user's report history (summary view without content).
     * 
     * @return List of report summaries containing id, title, and date
     */
    @GetMapping
    public ResponseEntity<List<ReportSummary>> getReportHistory() {
        return ResponseEntity.ok(reportService.getReportHistory());
    }

    /**
     * Retrieves a full report by its ID.
     * 
     * @param id Report UUID
     * @return Full report with content
     */
    @GetMapping("/{id}")
    public ResponseEntity<Report> getReport(@PathVariable UUID id) {
        return ResponseEntity.ok(reportService.getReport(id));
    }
}