package com.pathwise.backend.dto;

import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProjectionResponse {
    private BigDecimal targetAmount;
    private BigDecimal savedAmount;
    private BigDecimal remainingAmount;
    private BigDecimal monthlySavingsRate;
    private int monthsToGoal;
    private LocalDate projectedCompletionDate;
    private LocalDate deadline;
    private boolean onTrack;
    private int monthsAheadOrBehind;
    private List<ProjectionDataPoint> chartData;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ProjectionDataPoint {
        private String month;
        private BigDecimal projectedSavings;
        private BigDecimal targetLine;
    }
}