package com.pathwise.backend.dto;

import lombok.*;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AnalyticsResponse {

    private BigDecimal totalBalance;
    private BigDecimal totalIncome;
    private BigDecimal totalExpenses;

    // Category name -> total amount (for pie chart)
    private Map<String, BigDecimal> spendingByCategory;

    // Month (YYYY-MM) -> {income, expenses} (for bar chart)
    private List<MonthlyData> monthlyBreakdown;

    // Heatmap: date string -> amount
    private Map<String, BigDecimal> dailySpending;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class MonthlyData {
        private String month;
        private BigDecimal income;
        private BigDecimal expenses;
    }
}