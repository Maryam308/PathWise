package com.pathwise.backend.service;

import com.pathwise.backend.dto.AnomalyResponse;
import com.pathwise.backend.enums.SeverityLevel;
import com.pathwise.backend.enums.TransactionType;
import com.pathwise.backend.exception.UserNotFoundException;
import com.pathwise.backend.model.*;
import com.pathwise.backend.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AnomalyService {

    private final TransactionRepository transactionRepository;
    private final AnomalyRepository anomalyRepository;
    private final TransactionCategoryRepository categoryRepository;
    private final UserRepository userRepository;

    // Thresholds: spending ratio vs average that triggers an anomaly
    private static final double HIGH_THRESHOLD = 3.0;
    private static final double MEDIUM_THRESHOLD = 2.0;
    private static final double LOW_THRESHOLD = 1.5;

    public List<AnomalyResponse> detectAndGetAnomalies() {
        User user = getCurrentUser();
        detectAnomalies(user);
        return anomalyRepository
                .findByUserIdAndIsDismissedFalseOrderByCreatedAtDesc(user.getId())
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public void dismissAnomaly(UUID anomalyId) {
        User user = getCurrentUser();
        Anomaly anomaly = anomalyRepository.findById(anomalyId)
                .orElseThrow(() -> new IllegalArgumentException("Anomaly not found"));
        if (!anomaly.getUser().getId().equals(user.getId())) {
            throw new IllegalArgumentException("Not your anomaly");
        }
        anomaly.setIsDismissed(true);
        anomalyRepository.save(anomaly);
    }

    private void detectAnomalies(User user) {
        LocalDate now = LocalDate.now();
        LocalDate thisMonthStart = now.withDayOfMonth(1);
        LocalDate threeMonthsAgo = now.minusMonths(3);

        List<Transaction> allTransactions = transactionRepository
                .findByAccountUserIdAndTransactionDateBetween(user.getId(), threeMonthsAgo, now);

        // Current month debits grouped by category
        Map<String, BigDecimal> currentMonthByCategory = allTransactions.stream()
                .filter(t -> t.getType() == TransactionType.DEBIT
                        && !t.getTransactionDate().isBefore(thisMonthStart))
                .collect(Collectors.groupingBy(
                        t -> t.getCategory() != null ? t.getCategory().getName() : "OTHER",
                        Collectors.reducing(BigDecimal.ZERO, Transaction::getAmount, BigDecimal::add)
                ));

        // Historical debits (excluding current month) grouped by category
        Map<String, BigDecimal> historicalByCategory = allTransactions.stream()
                .filter(t -> t.getType() == TransactionType.DEBIT
                        && t.getTransactionDate().isBefore(thisMonthStart))
                .collect(Collectors.groupingBy(
                        t -> t.getCategory() != null ? t.getCategory().getName() : "OTHER",
                        Collectors.reducing(BigDecimal.ZERO, Transaction::getAmount, BigDecimal::add)
                ));

        long historicalMonths = Math.max(1, 3 - 1); // months of history (up to 2 full months)

        currentMonthByCategory.forEach((categoryName, currentAmount) -> {
            BigDecimal historicalTotal = historicalByCategory.getOrDefault(categoryName, BigDecimal.ZERO);
            BigDecimal monthlyAvg = historicalTotal.divide(
                    BigDecimal.valueOf(historicalMonths), 2, RoundingMode.HALF_UP);

            if (monthlyAvg.compareTo(BigDecimal.ZERO) == 0) return; // no baseline

            double ratio = currentAmount.divide(monthlyAvg, 4, RoundingMode.HALF_UP).doubleValue();

            SeverityLevel severity = null;
            if (ratio >= HIGH_THRESHOLD) severity = SeverityLevel.HIGH;
            else if (ratio >= MEDIUM_THRESHOLD) severity = SeverityLevel.MEDIUM;
            else if (ratio >= LOW_THRESHOLD) severity = SeverityLevel.LOW;

            if (severity == null) return;

            // Check if anomaly already exists for this category this month
            boolean exists = anomalyRepository
                    .findByUserIdAndIsDismissedFalseOrderByCreatedAtDesc(user.getId())
                    .stream()
                    .anyMatch(a -> a.getCategory() != null
                            && a.getCategory().getName().equals(categoryName)
                            && a.getCreatedAt().getMonth() == LocalDateTime.now().getMonth());

            if (exists) return;

            TransactionCategory category = categoryRepository.findByName(categoryName).orElse(null);
            String ratioStr = String.format("%.1f", ratio);

            String message = switch (severity) {
                case HIGH -> String.format("You spent %s× your usual amount this month. BD %.0f vs avg BD %.0f",
                        ratioStr, currentAmount, monthlyAvg);
                case MEDIUM -> String.format("BD %.0f spent — %s× above your 3-month average of BD %.0f",
                        currentAmount, ratioStr, monthlyAvg);
                case LOW -> String.format("Spending increased %s× compared to your usual BD %.0f",
                        ratioStr, monthlyAvg);
            };

            anomalyRepository.save(Anomaly.builder()
                    .user(user)
                    .category(category)
                    .severity(severity)
                    .message(message)
                    .actualAmount(currentAmount)
                    .baselineAmount(monthlyAvg)
                    .isDismissed(false)
                    .createdAt(LocalDateTime.now())
                    .build());

            log.info("Anomaly detected: {} - {} severity, ratio {}", categoryName, severity, ratioStr);
        });
    }

    private AnomalyResponse toResponse(Anomaly a) {
        return AnomalyResponse.builder()
                .id(a.getId())
                .category(a.getCategory() != null ? a.getCategory().getName() : "OTHER")
                .severity(a.getSeverity().name())
                .message(a.getMessage())
                .actualAmount(a.getActualAmount())
                .baselineAmount(a.getBaselineAmount())
                .isDismissed(a.getIsDismissed())
                .createdAt(a.getCreatedAt())
                .build();
    }

    private User getCurrentUser() {
        UserDetails userDetails = (UserDetails) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        return userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new UserNotFoundException("User not found"));
    }
}