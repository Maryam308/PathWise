package com.pathwise.backend.controller;

import com.pathwise.backend.model.Report;
import com.pathwise.backend.service.ReportService;
import com.pathwise.backend.service.ReportService.ReportSummary;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;

    // Generate new report — returns full report immediately (shown as current)
    @PostMapping("/generate")
    public ResponseEntity<Report> generateReport() {
        return ResponseEntity.ok(reportService.generateReport());
    }

    // History list — lightweight (id, title, createdAt only, no content)
    @GetMapping
    public ResponseEntity<List<ReportSummary>> getReportHistory() {
        return ResponseEntity.ok(reportService.getReportHistory());
    }

    // Get full report when user clicks on one from history
    @GetMapping("/{id}")
    public ResponseEntity<Report> getReport(@PathVariable UUID id) {
        return ResponseEntity.ok(reportService.getReport(id));
    }
}