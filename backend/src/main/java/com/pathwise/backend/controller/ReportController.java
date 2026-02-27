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

    // Manual trigger — for testing. Auto runs monthly via scheduler.
    @PostMapping("/generate")
    public ResponseEntity<Report> generateReport() {
        return ResponseEntity.ok(reportService.generateReport());
    }

    // History list — id, title, date only (no content)
    @GetMapping
    public ResponseEntity<List<ReportSummary>> getReportHistory() {
        return ResponseEntity.ok(reportService.getReportHistory());
    }

    // Full report — loaded when user clicks a report from history
    @GetMapping("/{id}")
    public ResponseEntity<Report> getReport(@PathVariable UUID id) {
        return ResponseEntity.ok(reportService.getReport(id));
    }
}