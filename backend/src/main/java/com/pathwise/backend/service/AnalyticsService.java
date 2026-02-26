package com.pathwise.backend.service;

import com.pathwise.backend.dto.AnalyticsResponse;
import com.pathwise.backend.dto.AnalyticsResponse.MonthlyData;
import com.pathwise.backend.enums.TransactionType;
import com.pathwise.backend.exception.UserNotFoundException;
import com.pathwise.backend.model.Transaction;
import com.pathwise.backend.model.User;
import com.pathwise.backend.repository.AccountRepository;
import com.pathwise.backend.repository.TransactionRepository;
import com.pathwise.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AnalyticsService {

    private final TransactionRepository transactionRepository;
    private final AccountRepository accountRepository;
    private final UserRepository userRepository;

    public AnalyticsResponse getAnalytics(int months) {
        User user = getCurrentUser();
        LocalDate end = LocalDate.now();
        LocalDate start = end.minusMonths(months);

        List<Transaction> transactions = transactionRepository
                .findByAccountUserIdAndTransactionDateBetween(user.getId(), start, end);

        BigDecimal totalBalance = accountRepository.findByUserId(user.getId())
                .map(a -> a.getBalance() != null ? a.getBalance() : BigDecimal.ZERO)
                .orElse(BigDecimal.ZERO);

        BigDecimal totalIncome = transactions.stream()
                .filter(t -> t.getType() == TransactionType.CREDIT)
                .map(Transaction::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalExpenses = transactions.stream()
                .filter(t -> t.getType() == TransactionType.DEBIT)
                .map(Transaction::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Pie chart: spending by category
        Map<String, BigDecimal> spendingByCategory = transactions.stream()
                .filter(t -> t.getType() == TransactionType.DEBIT)
                .collect(Collectors.groupingBy(
                        t -> t.getCategory() != null ? t.getCategory().getName() : "OTHER",
                        Collectors.reducing(BigDecimal.ZERO, Transaction::getAmount, BigDecimal::add)
                ));

        // Bar chart: monthly income vs expenses
        DateTimeFormatter monthFmt = DateTimeFormatter.ofPattern("yyyy-MM");
        Map<String, MonthlyData> monthlyMap = new LinkedHashMap<>();

        transactions.forEach(t -> {
            String month = t.getTransactionDate().format(monthFmt);
            monthlyMap.computeIfAbsent(month, m -> MonthlyData.builder()
                    .month(m).income(BigDecimal.ZERO).expenses(BigDecimal.ZERO).build());

            MonthlyData data = monthlyMap.get(month);
            if (t.getType() == TransactionType.CREDIT) {
                data.setIncome(data.getIncome().add(t.getAmount()));
            } else {
                data.setExpenses(data.getExpenses().add(t.getAmount()));
            }
        });

        List<MonthlyData> monthlyBreakdown = new ArrayList<>(monthlyMap.values());
        monthlyBreakdown.sort(Comparator.comparing(MonthlyData::getMonth));

        // Heatmap: daily spending
        Map<String, BigDecimal> dailySpending = transactions.stream()
                .filter(t -> t.getType() == TransactionType.DEBIT)
                .collect(Collectors.groupingBy(
                        t -> t.getTransactionDate().toString(),
                        Collectors.reducing(BigDecimal.ZERO, Transaction::getAmount, BigDecimal::add)
                ));

        return AnalyticsResponse.builder()
                .totalBalance(totalBalance)
                .totalIncome(totalIncome)
                .totalExpenses(totalExpenses)
                .spendingByCategory(spendingByCategory)
                .monthlyBreakdown(monthlyBreakdown)
                .dailySpending(dailySpending)
                .build();
    }

    private User getCurrentUser() {
        UserDetails userDetails = (UserDetails) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        return userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new UserNotFoundException("User not found"));
    }
}