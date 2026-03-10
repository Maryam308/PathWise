package com.pathwise.backend.service;

import com.pathwise.backend.dto.AnalyticsResponse;
import com.pathwise.backend.dto.AnalyticsResponse.MonthlyData;
import com.pathwise.backend.enums.TransactionType;
import com.pathwise.backend.exception.UserNotFoundException;
import com.pathwise.backend.model.Account;
import com.pathwise.backend.model.Transaction;
import com.pathwise.backend.model.User;
import com.pathwise.backend.repository.AccountRepository;
import com.pathwise.backend.repository.TransactionRepository;
import com.pathwise.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Service responsible for calculating financial analytics and metrics.
 * Provides data for dashboards, charts, and reports including income,
 * expenses, balances, and spending patterns.
 * 
 * @author PathWise Team
 * @version 1.0
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AnalyticsService {

    private final TransactionRepository transactionRepository;
    private final AccountRepository accountRepository;
    private final UserRepository userRepository;

    private static final DateTimeFormatter MONTH_FMT = DateTimeFormatter.ofPattern("MMM yyyy");
    private static final DateTimeFormatter SORT_FMT = DateTimeFormatter.ofPattern("yyyy-MM");

    /**
     * Retrieves analytics for the current authenticated user.
     * 
     * @param months Number of months to analyze
     * @return AnalyticsResponse containing all financial metrics
     */
    public AnalyticsResponse getAnalytics(int months) {
        return getAnalyticsForUser(getCurrentUser(), months);
    }

    /**
     * Core analytics calculation for a specific user.
     * 
     * @param user User entity
     * @param months Number of months to analyze
     * @return AnalyticsResponse containing all financial metrics
     */
    public AnalyticsResponse getAnalyticsForUser(User user, int months) {
        LocalDate end = LocalDate.now();
        LocalDate start = end.minusMonths(months);

        // Get transactions for the selected period (for bar chart)
        List<Transaction> periodTransactions = transactionRepository
                .findByAccountUserIdAndTransactionDateBetween(user.getId(), start, end);

        // Get current month transactions (for pie chart when months=1)
        LocalDate monthStart = LocalDate.now().withDayOfMonth(1);
        LocalDate monthEnd = LocalDate.now();
        List<Transaction> currentMonthTransactions = transactionRepository
                .findByAccountUserIdAndTransactionDateBetween(user.getId(), monthStart, monthEnd);

        // Get account balance from Plaid
        BigDecimal plaidBalance = accountRepository.findByUserId(user.getId())
                .map(Account::getBalance)
                .orElse(BigDecimal.ZERO);

        // Get monthly salary from user
        BigDecimal monthlySalary = user.getMonthlySalary() != null ? user.getMonthlySalary() : BigDecimal.ZERO;

        // ===== CALCULATIONS =====

        // 1. Current month income = salary + current month credit transactions
        BigDecimal currentMonthIncome = calculateCurrentMonthIncome(currentMonthTransactions, monthlySalary);

        // 2. Current month expenses = current month debit transactions only
        BigDecimal currentMonthExpenses = calculateCurrentMonthExpenses(currentMonthTransactions);

        // Use appropriate transactions for pie chart based on selected months
        List<Transaction> pieChartTransactions;
        
        if (months == 1) {
            // For "This month" button, use ONLY current month transactions
            pieChartTransactions = currentMonthTransactions;
        } else {
            // For other ranges (3, 6, 12 months), use the selected period
            pieChartTransactions = periodTransactions;
        }

        // Spending by category for pie chart
        Map<String, BigDecimal> spendingByCategory = pieChartTransactions.stream()
                .filter(t -> t.getType() == TransactionType.DEBIT)
                .collect(Collectors.groupingBy(
                        t -> t.getCategory() != null ? t.getCategory().getName() : "OTHER",
                        Collectors.reducing(BigDecimal.ZERO, Transaction::getAmount, BigDecimal::add)
                ));

        log.debug("Analytics for user {} - Period: {} months, Income: {}, Expenses: {}", 
            user.getId(), months, currentMonthIncome, currentMonthExpenses);

        // Monthly breakdown for bar chart
        List<MonthlyData> monthlyBreakdown = generateMonthlyBreakdown(user, months, monthlySalary);

        // Daily spending (for heatmap/line chart)
        Map<String, BigDecimal> dailySpending = periodTransactions.stream()
                .filter(t -> t.getType() == TransactionType.DEBIT)
                .filter(t -> t.getTransactionDate().isAfter(LocalDate.now().minusDays(30)))
                .collect(Collectors.groupingBy(
                        t -> t.getTransactionDate().toString(),
                        Collectors.reducing(BigDecimal.ZERO, Transaction::getAmount, BigDecimal::add)
                ));

        return AnalyticsResponse.builder()
                .totalBalance(plaidBalance)                    // Just the Plaid balance
                .totalIncome(currentMonthIncome)               // Salary + current month credits ONLY
                .totalExpenses(currentMonthExpenses)           // Current month expenses only
                .spendingByCategory(spendingByCategory)        // Dynamic based on selected months
                .monthlyBreakdown(monthlyBreakdown)
                .dailySpending(dailySpending)
                .build();
    }

    /**
     * Calculates total income for the current month.
     * 
     * @param transactions List of current month transactions
     * @param monthlySalary User's monthly salary
     * @return Total income (salary + credits)
     */
    private BigDecimal calculateCurrentMonthIncome(List<Transaction> transactions, BigDecimal monthlySalary) {
        BigDecimal creditTotal = transactions.stream()
                .filter(t -> t.getType() == TransactionType.CREDIT)
                .map(Transaction::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        
        return monthlySalary.add(creditTotal);
    }

    /**
     * Calculates total expenses for the current month.
     * 
     * @param transactions List of current month transactions
     * @return Total expenses (debits)
     */
    private BigDecimal calculateCurrentMonthExpenses(List<Transaction> transactions) {
        return transactions.stream()
                .filter(t -> t.getType() == TransactionType.DEBIT)
                .map(Transaction::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /**
     * Generates monthly breakdown data for bar charts.
     * 
     * @param user User entity
     * @param months Number of months to include
     * @param monthlySalary User's monthly salary
     * @return List of MonthlyData objects for charting
     */
    private List<MonthlyData> generateMonthlyBreakdown(User user, int months, BigDecimal monthlySalary) {
        List<MonthlyData> breakdown = new ArrayList<>();
        LocalDate now = LocalDate.now();
        
        for (int i = months - 1; i >= 0; i--) {
            LocalDate monthDate = now.minusMonths(i);
            
            LocalDate monthStart = monthDate.withDayOfMonth(1);
            LocalDate monthEnd = monthDate.withDayOfMonth(monthDate.lengthOfMonth());
            
            List<Transaction> monthTransactions = transactionRepository
                    .findByAccountUserIdAndTransactionDateBetween(user.getId(), monthStart, monthEnd);
            
            // Skip empty months for older periods
            if (monthTransactions.isEmpty() && i > 2) continue;
            
            // Calculate income from credit transactions this month
            BigDecimal creditIncome = monthTransactions.stream()
                    .filter(t -> t.getType() == TransactionType.CREDIT)
                    .map(Transaction::getAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            
            // For current month, add salary
            BigDecimal income;
            if (i == 0) {
                income = monthlySalary.add(creditIncome);
                log.debug("Current month {} - Credits: {}, Salary: {}, Total Income: {}", 
                    monthDate.format(MONTH_FMT), creditIncome, monthlySalary, income);
            } else {
                income = creditIncome;
            }
            
            BigDecimal expenses = monthTransactions.stream()
                    .filter(t -> t.getType() == TransactionType.DEBIT)
                    .map(Transaction::getAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            
            String monthName = monthDate.format(MONTH_FMT);
            String sortKey = monthDate.format(SORT_FMT);
            
            BigDecimal savingsRate = calculateSavingsRate(income, expenses);
            
            breakdown.add(MonthlyData.builder()
                    .month(monthName)
                    .sortKey(sortKey)
                    .income(income)
                    .expenses(expenses)
                    .savingsRate(savingsRate)
                    .build());
        }
        
        breakdown.sort(Comparator.comparing(MonthlyData::getSortKey));
        return breakdown;
    }

    /**
     * Calculates savings rate percentage.
     * 
     * @param income Total income
     * @param expenses Total expenses
     * @return Savings rate as percentage
     */
    private BigDecimal calculateSavingsRate(BigDecimal income, BigDecimal expenses) {
        if (income.compareTo(BigDecimal.ZERO) == 0) return BigDecimal.ZERO;
        return income.subtract(expenses)
                .divide(income, 4, RoundingMode.HALF_UP)
                .multiply(new BigDecimal("100"))
                .setScale(1, RoundingMode.HALF_UP);
    }

    /**
     * Retrieves the current authenticated user.
     * 
     * @return User entity
     * @throws UserNotFoundException if user not found
     */
    private User getCurrentUser() {
        UserDetails userDetails = (UserDetails) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        return userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new UserNotFoundException("User not found"));
    }
}