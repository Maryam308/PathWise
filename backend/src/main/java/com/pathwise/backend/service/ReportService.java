package com.pathwise.backend.service;

import com.pathwise.backend.dto.AnalyticsResponse;
import com.pathwise.backend.exception.UserNotFoundException;
import com.pathwise.backend.model.Report;
import com.pathwise.backend.model.User;
import com.pathwise.backend.repository.AnomalyRepository;
import com.pathwise.backend.repository.ReportRepository;
import com.pathwise.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReportService {

    private final ReportRepository reportRepository;
    private final AnomalyRepository anomalyRepository;
    private final AnalyticsService analyticsService;
    private final UserRepository userRepository;
    private final RestTemplate restTemplate;

    @Value("${groq.api-key}")
    private String groqApiKey;

    @Value("${groq.url}")
    private String groqUrl;

    @Value("${groq.model}")
    private String groqModel;

    private static final DateTimeFormatter TITLE_FORMAT = DateTimeFormatter.ofPattern("MMM yyyy");

    public Report generateReport() {
        User user = getCurrentUser();
        AnalyticsResponse analytics = analyticsService.getAnalytics(3);

        String anomalySummary = anomalyRepository
                .findByUserIdAndIsDismissedFalseOrderByCreatedAtDesc(user.getId())
                .stream()
                .map(a -> String.format("- %s (%s): %s",
                        a.getCategory() != null ? a.getCategory().getName() : "OTHER",
                        a.getSeverity(),
                        a.getMessage()))
                .collect(Collectors.joining("\n"));

        String categorySummary = analytics.getSpendingByCategory().entrySet().stream()
                .map(e -> String.format("- %s: BD %.2f", e.getKey(), e.getValue()))
                .collect(Collectors.joining("\n"));

        String prompt = String.format("""
                Generate a concise personal finance report for the last 3 months.
                
                Summary:
                - Total Balance: BD %.2f
                - Total Income: BD %.2f
                - Total Expenses: BD %.2f
                - Net: BD %.2f
                
                Spending by Category:
                %s
                
                Active Anomalies:
                %s
                
                Write a 3-4 paragraph report with:
                1. Overall financial health summary
                2. Key spending patterns and categories
                3. Anomaly insights and what they mean
                4. 2-3 specific, actionable recommendations
                
                Keep it professional, concise, and encouraging. Use BHD currency.
                """,
                analytics.getTotalBalance(),
                analytics.getTotalIncome(),
                analytics.getTotalExpenses(),
                analytics.getTotalIncome().subtract(analytics.getTotalExpenses()),
                categorySummary.isEmpty() ? "No spending data" : categorySummary,
                anomalySummary.isEmpty() ? "No anomalies detected" : anomalySummary
        );

        String content = callGroq(prompt);

        LocalDate now = LocalDate.now();
        String title = "Financial Report - " + now.format(TITLE_FORMAT);

        Report report = Report.builder()
                .user(user)
                .title(title)
                .periodStart(now.minusMonths(3))
                .periodEnd(now)
                .content(content)
                .createdAt(LocalDateTime.now())
                .build();

        return reportRepository.save(report);
    }

    // Returns all reports for history list (id, title, createdAt only — no content)
    public List<ReportSummary> getReportHistory() {
        User user = getCurrentUser();
        return reportRepository.findByUserIdOrderByCreatedAtDesc(user.getId())
                .stream()
                .map(r -> new ReportSummary(r.getId(), r.getTitle(), r.getCreatedAt()))
                .toList();
    }

    // Returns a single full report when user clicks on it
    public Report getReport(java.util.UUID reportId) {
        User user = getCurrentUser();
        Report report = reportRepository.findById(reportId)
                .orElseThrow(() -> new IllegalArgumentException("Report not found"));
        if (!report.getUser().getId().equals(user.getId())) {
            throw new IllegalArgumentException("Not your report");
        }
        return report;
    }

    private String callGroq(String prompt) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(groqApiKey);

        Map<String, Object> body = Map.of(
                "model", groqModel,
                "messages", List.of(Map.of("role", "user", "content", prompt)),
                "max_tokens", 800,
                "temperature", 0.7
        );

        try {
            Map response = restTemplate.postForObject(groqUrl,
                    new HttpEntity<>(body, headers), Map.class);
            List choices = (List) response.get("choices");
            Map firstChoice = (Map) choices.get(0);
            Map msg = (Map) firstChoice.get("message");
            return (String) msg.get("content");
        } catch (Exception e) {
            log.error("Groq report generation failed: {}", e.getMessage());
            return "Report generation failed. Please try again later.";
        }
    }

    private User getCurrentUser() {
        UserDetails userDetails = (UserDetails) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        return userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new UserNotFoundException("User not found"));
    }

    // Lightweight summary for the history list (no content)
    public record ReportSummary(java.util.UUID id, String title, LocalDateTime createdAt) {}
}