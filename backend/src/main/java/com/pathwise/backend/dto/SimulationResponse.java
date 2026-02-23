package com.pathwise.backend.dto;

import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SimulationResponse {
    private String name;
    private BigDecimal originalMonthlySavingsRate;
    private BigDecimal newMonthlySavingsRate;
    private BigDecimal totalAdjustment;
    private int baselineMonthsToGoal;
    private int simulatedMonthsToGoal;
    private int monthsSaved;
    private LocalDate baselineCompletionDate;
    private LocalDate simulatedCompletionDate;
    private LocalDate deadline;
    private boolean onTrack;
    private Map<String, BigDecimal> adjustments;
    private List<ProjectionResponse.ProjectionDataPoint> chartData;
}