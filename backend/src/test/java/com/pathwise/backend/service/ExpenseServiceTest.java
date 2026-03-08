package com.pathwise.backend.service;

import com.pathwise.backend.config.TestDataFactory;
import com.pathwise.backend.dto.RegisterRequest;
import com.pathwise.backend.enums.ExpenseCategory;
import com.pathwise.backend.model.MonthlyExpense;
import com.pathwise.backend.model.User;
import com.pathwise.backend.repository.GoalRepository;
import com.pathwise.backend.repository.MonthlyExpenseRepository;
import com.pathwise.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for FinancialProfileService (expense management).
 *
 * PathWise does not have a standalone ExpenseService. Expense logic lives in
 * FinancialProfileService — specifically saveExpenses(), replaceExpenses(),
 * getDisposableIncome(), and getTotalMonthlySavings().
 */
@ExtendWith(MockitoExtension.class)
class ExpenseServiceTest {

    @Mock
    private MonthlyExpenseRepository expenseRepository;

    @Mock
    private GoalRepository goalRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private FinancialProfileService financialProfileService;

    private User testUser;
    private MonthlyExpense testExpense;

    @BeforeEach
    void setUp() {
        testUser = TestDataFactory.createTestUser();
        testExpense = TestDataFactory.createTestExpense(testUser);
    }

    // ─── saveExpenses ─────────────────────────────────────────────────────────

    @Test
    void saveExpenses_WithValidItems_PersistsExpenses() {
        RegisterRequest.ExpenseItem rent = new RegisterRequest.ExpenseItem();
        rent.setCategory(ExpenseCategory.HOUSING);
        rent.setAmount(new BigDecimal("500.000"));
        rent.setLabel("Rent");

        when(userRepository.findById(testUser.getId())).thenReturn(java.util.Optional.of(testUser));
        when(expenseRepository.saveAll(anyList())).thenReturn(List.of(testExpense));

        financialProfileService.saveExpenses(testUser.getId(), List.of(rent));

        verify(expenseRepository).saveAll(anyList());
    }

    @Test
    void saveExpenses_WithNullList_DoesNotPersistAnything() {
        financialProfileService.saveExpenses(testUser.getId(), null);

        verifyNoInteractions(expenseRepository);
        verifyNoInteractions(userRepository);
    }

    @Test
    void saveExpenses_WithEmptyList_DoesNotPersistAnything() {
        financialProfileService.saveExpenses(testUser.getId(), List.of());

        verifyNoInteractions(expenseRepository);
    }

    @Test
    void saveExpenses_FiltersOutZeroAmountItems() {
        RegisterRequest.ExpenseItem zeroItem = new RegisterRequest.ExpenseItem();
        zeroItem.setCategory(ExpenseCategory.FOOD);
        zeroItem.setAmount(BigDecimal.ZERO);
        zeroItem.setLabel("Free item");

        when(userRepository.findById(testUser.getId())).thenReturn(java.util.Optional.of(testUser));

        financialProfileService.saveExpenses(testUser.getId(), List.of(zeroItem));

        // saveAll should not be called because all items were filtered out
        verify(expenseRepository, never()).saveAll(anyList());
    }

    // ─── replaceExpenses ──────────────────────────────────────────────────────

    @Test
    void replaceExpenses_DeletesOldAndSavesNew() {
        RegisterRequest.ExpenseItem newRent = new RegisterRequest.ExpenseItem();
        newRent.setCategory(ExpenseCategory.HOUSING);
        newRent.setAmount(new BigDecimal("600.000"));
        newRent.setLabel("New Apartment");

        when(userRepository.existsById(testUser.getId())).thenReturn(true);
        when(userRepository.findById(testUser.getId())).thenReturn(java.util.Optional.of(testUser));
        when(expenseRepository.saveAll(anyList())).thenReturn(List.of(testExpense));

        financialProfileService.replaceExpenses(testUser.getId(), List.of(newRent));

        // Old expenses deleted first, then new ones saved
        verify(expenseRepository).deleteByUserId(testUser.getId());
        verify(expenseRepository).saveAll(anyList());
    }

    @Test
    void replaceExpenses_WithNonExistentUser_ThrowsException() {
        when(userRepository.existsById(testUser.getId())).thenReturn(false);

        assertThrows(Exception.class,
                () -> financialProfileService.replaceExpenses(testUser.getId(), List.of()));
    }

    // ─── getDisposableIncome ──────────────────────────────────────────────────

    @Test
    void getDisposableIncome_ReturnsSalaryMinusExpenses() {
        // testUser salary = 2000, expenses = 500 → disposable = 1500
        when(expenseRepository.sumByUserId(testUser.getId()))
                .thenReturn(new BigDecimal("500.000"));

        BigDecimal disposable = financialProfileService.getDisposableIncome(testUser);

        assertEquals(new BigDecimal("1500.000"), disposable);
    }

    @Test
    void getDisposableIncome_WithNoExpenses_ReturnsSalary() {
        when(expenseRepository.sumByUserId(testUser.getId()))
                .thenReturn(BigDecimal.ZERO);

        BigDecimal disposable = financialProfileService.getDisposableIncome(testUser);

        assertEquals(testUser.getMonthlySalary(), disposable);
    }

    // ─── getTotalMonthlySavings ───────────────────────────────────────────────

    @Test
    void getTotalMonthlySavings_ReturnsCommittedAmount() {
        when(goalRepository.sumMonthlySavingsTargetByUserId(testUser.getId()))
                .thenReturn(new BigDecimal("300.000"));

        BigDecimal total = financialProfileService.getTotalMonthlySavings(testUser.getId());

        assertEquals(new BigDecimal("300.000"), total);
    }

    @Test
    void getTotalMonthlySavings_WithNoGoals_ReturnsZero() {
        when(goalRepository.sumMonthlySavingsTargetByUserId(testUser.getId()))
                .thenReturn(BigDecimal.ZERO);

        BigDecimal total = financialProfileService.getTotalMonthlySavings(testUser.getId());

        assertEquals(BigDecimal.ZERO, total);
    }

    // ─── getSnapshot ─────────────────────────────────────────────────────────

    @Test
    void getSnapshot_WithHealthyFinances_ReturnsNoneWarning() {
        when(expenseRepository.sumByUserId(testUser.getId()))
                .thenReturn(new BigDecimal("500.000"));
        when(goalRepository.sumMonthlySavingsTargetByUserId(testUser.getId()))
                .thenReturn(new BigDecimal("200.000"));

        var snapshot = financialProfileService.getSnapshot(testUser);

        assertNotNull(snapshot);
        assertEquals(new BigDecimal("2000.000"), snapshot.salary());
        assertEquals(new BigDecimal("1500.000"), snapshot.disposableIncome());
        assertEquals(FinancialProfileService.WarningLevel.NONE, snapshot.warningLevel());
    }

    @Test
    void getSnapshot_WhenExpensesExceedSalary_ReturnsRedWarning() {
        // expenses > salary → RED
        when(expenseRepository.sumByUserId(testUser.getId()))
                .thenReturn(new BigDecimal("2500.000")); // more than 2000 salary
        when(goalRepository.sumMonthlySavingsTargetByUserId(testUser.getId()))
                .thenReturn(BigDecimal.ZERO);

        var snapshot = financialProfileService.getSnapshot(testUser);

        assertEquals(FinancialProfileService.WarningLevel.RED, snapshot.warningLevel());
        assertNotNull(snapshot.warningMessage());
    }

    @Test
    void getSnapshot_WhenSavingsRateExceeds50Percent_ReturnsRedWarning() {
        // disposable = 1500, savings = 900 → rate = 60% → RED
        when(expenseRepository.sumByUserId(testUser.getId()))
                .thenReturn(new BigDecimal("500.000"));
        when(goalRepository.sumMonthlySavingsTargetByUserId(testUser.getId()))
                .thenReturn(new BigDecimal("900.000"));

        var snapshot = financialProfileService.getSnapshot(testUser);

        assertEquals(FinancialProfileService.WarningLevel.RED, snapshot.warningLevel());
    }

    @Test
    void getSnapshot_WhenSavingsRateBetween30And50_ReturnsAmberWarning() {
        // disposable = 1500, savings = 600 → rate = 40% → AMBER
        when(expenseRepository.sumByUserId(testUser.getId()))
                .thenReturn(new BigDecimal("500.000"));
        when(goalRepository.sumMonthlySavingsTargetByUserId(testUser.getId()))
                .thenReturn(new BigDecimal("600.000"));

        var snapshot = financialProfileService.getSnapshot(testUser);

        assertEquals(FinancialProfileService.WarningLevel.AMBER, snapshot.warningLevel());
    }
}