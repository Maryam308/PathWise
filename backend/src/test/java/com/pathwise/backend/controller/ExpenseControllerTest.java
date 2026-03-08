package com.pathwise.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pathwise.backend.config.TestDataFactory;
import com.pathwise.backend.config.TestSecurityConfig;
import com.pathwise.backend.dto.RegisterRequest;
import com.pathwise.backend.enums.ExpenseCategory;
import com.pathwise.backend.model.User;
import com.pathwise.backend.repository.UserRepository;
import com.pathwise.backend.service.FinancialProfileService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ExpenseController.class)
@Import({TestSecurityConfig.class, TestDataFactory.class})
class ExpenseControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private FinancialProfileService financialProfileService;

    @MockitoBean
    private UserRepository userRepository;

    private List<RegisterRequest.ExpenseItem> validExpenses;
    private User testUser;

    @BeforeEach
    void setUp() {
        testUser = TestDataFactory.createTestUser();

        when(userRepository.findByEmail(anyString())).thenReturn(Optional.of(testUser));

        RegisterRequest.ExpenseItem rent = new RegisterRequest.ExpenseItem();
        rent.setCategory(ExpenseCategory.HOUSING);
        rent.setAmount(new BigDecimal("500.000"));
        rent.setLabel("Rent");

        RegisterRequest.ExpenseItem food = new RegisterRequest.ExpenseItem();
        food.setCategory(ExpenseCategory.FOOD);
        food.setAmount(new BigDecimal("200.000"));
        food.setLabel("Groceries");

        validExpenses = List.of(rent, food);
    }

    // ─── GET /api/expenses ────────────────────────────────────────────────────

    @Test
    @WithMockUser
    void getExpenses_AuthenticatedUser_ReturnsOk() throws Exception {
        mockMvc.perform(get("/api/expenses"))
                .andExpect(status().isOk());
    }

    @Test
    void getExpenses_WithoutAuth_ReturnsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/expenses"))
                .andExpect(status().isUnauthorized());
    }

    // ─── PUT /api/expenses ────────────────────────────────────────────────────

    @Test
    @WithMockUser
    void replaceExpenses_WithValidData_ReturnsOk() throws Exception {
        doNothing().when(financialProfileService)
                .replaceExpenses(any(UUID.class), any());

        mockMvc.perform(put("/api/expenses")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validExpenses)))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser
    void replaceExpenses_WithEmptyList_ReturnsOk() throws Exception {
        doNothing().when(financialProfileService)
                .replaceExpenses(any(UUID.class), any());

        mockMvc.perform(put("/api/expenses")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("[]"))
                .andExpect(status().isOk());
    }

    @Test
    void replaceExpenses_WithoutAuth_ReturnsUnauthorized() throws Exception {
        mockMvc.perform(put("/api/expenses")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validExpenses)))
                .andExpect(status().isUnauthorized());
    }
}