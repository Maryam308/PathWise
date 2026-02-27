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

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.UUID;
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

    // Called from controller — manual trigger kept for testing
    public Report generateReport() {
        return generateReportForUser(getCurrentUser());
    }

    // Called by MonthlyReportScheduler — no security context needed
    public Report generateReportForUser(User user) {
        log.info("Generating report for user: {}", user.getEmail());

        AnalyticsResponse analytics = analyticsService.getAnalyticsForUser(user, 3);

        // Calculate savings rate here since it was removed from AnalyticsResponse
        BigDecimal savingsRate = analytics.getTotalIncome().compareTo(BigDecimal.ZERO) > 0
                ? analytics.getTotalIncome()
                        .subtract(analytics.getTotalExpenses())
                        .divide(analytics.getTotalIncome(), 4, RoundingMode.HALF_UP)
                        .multiply(BigDecimal.valueOf(100))
                        .setScale(1, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

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

        String monthlySummary = analytics.getMonthlyBreakdown().stream()
                .map(m -> String.format("- %s: Income BD %.2f | Expenses BD %.2f | Net BD %.2f",
                        m.getMonth(),
                        m.getIncome(),
                        m.getExpenses(),
                        m.getIncome().subtract(m.getExpenses())))
                .collect(Collectors.joining("\n"));

        String prompt = String.format("""
                Generate a concise personal finance report for the last 3 months.

                Overall Summary:
                - Total Balance: BD %.2f
                - Total Income: BD %.2f
                - Total Expenses: BD %.2f
                - Net Savings: BD %.2f
                - Savings Rate: %.1f%%

                Monthly Breakdown:
                %s

                Spending by Category:
                %s

                Active Anomalies:
                %s

                Write a professional 3-4 paragraph report covering:
                1. Overall financial health and savings rate assessment
                2. Key spending patterns — which categories dominate and monthly trends
                3. Anomaly insights — what unusual spending means and potential causes
                4. 2-3 specific, actionable recommendations to improve finances

                Keep the tone encouraging and professional. Use BHD currency. Be specific with numbers.
                """,
                analytics.getTotalBalance(),
                analytics.getTotalIncome(),
                analytics.getTotalExpenses(),
                analytics.getTotalIncome().subtract(analytics.getTotalExpenses()),
                savingsRate,
                monthlySummary.isEmpty() ? "No monthly data available" : monthlySummary,
                categorySummary.isEmpty() ? "No spending data" : categorySummary,
                anomalySummary.isEmpty() ? "No anomalies detected" : anomalySummary
        );

        String content = callGroq(prompt);
        LocalDate now = LocalDate.now();

        Report report = Report.builder()
                .user(user)
                .title("Financial Report - " + now.format(TITLE_FORMAT))
                .periodStart(now.minusMonths(3))
                .periodEnd(now)
                .content(content)
                .createdAt(LocalDateTime.now())
                .build();

        Report saved = reportRepository.save(report);
        log.info("✅ Report saved: {}", saved.getTitle());
        return saved;
    }

    // Lightweight list for history screen — no content field
    public List<ReportSummary> getReportHistory() {
        User user = getCurrentUser();
        return reportRepository.findByUserIdOrderByCreatedAtDesc(user.getId())
                .stream()
                .map(r -> new ReportSummary(r.getId(), r.getTitle(), r.getCreatedAt()))
                .toList();
    }

    // Full report when user clicks from history
    public Report getReport(UUID reportId) {
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
                "max_tokens", 1000,
                "temperature", 0.7
        );

        try {
            log.info("Calling Groq for report generation...");
            Map response = restTemplate.postForObject(groqUrl,
                    new HttpEntity<>(body, headers), Map.class);
            List choices = (List) response.get("choices");
            Map firstChoice = (Map) choices.get(0);
            Map msg = (Map) firstChoice.get("message");
            String content = (String) msg.get("content");
            log.info("✅ Report generated ({} chars)", content.length());
            return content;
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

    public record ReportSummary(UUID id, String title, LocalDateTime createdAt) {}
}