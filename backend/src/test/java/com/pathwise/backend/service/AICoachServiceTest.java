package com.pathwise.backend.service;

import com.pathwise.backend.config.TestDataFactory;
import com.pathwise.backend.dto.ChatRequest;
import com.pathwise.backend.dto.ChatResponse;
import com.pathwise.backend.exception.AIServiceUnavailableException;
import com.pathwise.backend.exception.MessageTooLongException;
import com.pathwise.backend.model.AdviceHistory;
import com.pathwise.backend.model.Goal;
import com.pathwise.backend.model.MonthlyExpense;
import com.pathwise.backend.model.User;
import com.pathwise.backend.repository.AdviceHistoryRepository;
import com.pathwise.backend.repository.GoalRepository;
import com.pathwise.backend.repository.MonthlyExpenseRepository;
import com.pathwise.backend.repository.UserRepository;
import com.pathwise.backend.service.FinancialProfileService.FinancialSnapshot;
import com.pathwise.backend.service.FinancialProfileService.WarningLevel;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AICoachServiceTest {

    @Mock private UserRepository           userRepository;
    @Mock private GoalRepository           goalRepository;
    @Mock private AdviceHistoryRepository  adviceHistoryRepository;
    @Mock private MonthlyExpenseRepository expenseRepository;
    @Mock private FinancialProfileService  financialProfileService;
    @Mock private RestTemplate             restTemplate;

    @InjectMocks
    private AICoachService aiCoachService;

    // Inject groqApiKey via reflection (field is @Value private)
    @BeforeEach
    void injectApiKey() throws Exception {
        var field = AICoachService.class.getDeclaredField("groqApiKey");
        field.setAccessible(true);
        field.set(aiCoachService, "test-api-key");
    }

    private User testUser;
    private FinancialSnapshot mockSnapshot;

    @BeforeEach
    void setUp() {
        // Set up security context
        UserDetails mockUserDetails = mock(UserDetails.class);
        lenient().when(mockUserDetails.getUsername()).thenReturn("test@example.com");

        Authentication auth = mock(Authentication.class);
        lenient().when(auth.getPrincipal()).thenReturn(mockUserDetails);

        SecurityContext ctx = mock(SecurityContext.class);
        lenient().when(ctx.getAuthentication()).thenReturn(auth);

        SecurityContextHolder.setContext(ctx);

        testUser = TestDataFactory.createTestUser();

        mockSnapshot = new FinancialSnapshot(
                new BigDecimal("2000.000"),
                new BigDecimal("500.000"),
                new BigDecimal("1500.000"),
                new BigDecimal("0.000"),
                0.0,
                WarningLevel.NONE,
                null
        );

        // No stubbings in setUp - they'll be created per test as needed
    }

    // ── Input validation ──────────────────────────────────────────────────────

    @Test
    void chat_WithEmptyMessage_ThrowsMessageTooLongException() {
        ChatRequest request = new ChatRequest();
        request.setMessage("");

        assertThrows(MessageTooLongException.class, () -> aiCoachService.chat(request));
        verifyNoInteractions(userRepository, goalRepository, expenseRepository,
                financialProfileService, adviceHistoryRepository, restTemplate);
    }

    @Test
    void chat_WithBlankMessage_ThrowsMessageTooLongException() {
        ChatRequest request = new ChatRequest();
        request.setMessage("   ");

        assertThrows(MessageTooLongException.class, () -> aiCoachService.chat(request));
        verifyNoInteractions(userRepository, goalRepository, expenseRepository,
                financialProfileService, adviceHistoryRepository, restTemplate);
    }

    @Test
    void chat_WithNullMessage_ThrowsMessageTooLongException() {
        ChatRequest request = new ChatRequest();
        request.setMessage(null);

        assertThrows(MessageTooLongException.class, () -> aiCoachService.chat(request));
        verifyNoInteractions(userRepository, goalRepository, expenseRepository,
                financialProfileService, adviceHistoryRepository, restTemplate);
    }

    @Test
    void chat_WithTooLongMessage_ThrowsMessageTooLongException() {
        ChatRequest request = new ChatRequest();
        request.setMessage("a".repeat(2001)); // MAX_MESSAGE_LEN = 2000

        assertThrows(MessageTooLongException.class, () -> aiCoachService.chat(request));
        verifyNoInteractions(userRepository, goalRepository, expenseRepository,
                financialProfileService, adviceHistoryRepository, restTemplate);
    }

    @Test
    void chat_WithExactlyMaxLength_DoesNotThrow() {
        ChatRequest request = new ChatRequest();
        request.setMessage("a".repeat(2000)); // exactly at limit

        // Set up all required stubs for this test
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(goalRepository.findByUserId(testUser.getId())).thenReturn(List.of());
        when(expenseRepository.findByUserId(testUser.getId())).thenReturn(List.of());
        when(financialProfileService.getSnapshot(testUser)).thenReturn(mockSnapshot);
        when(adviceHistoryRepository.findTop10ByUserIdOrderByCreatedAtDesc(any()))
                .thenReturn(List.of());
        when(adviceHistoryRepository.save(any())).thenReturn(mock(AdviceHistory.class));
        when(restTemplate.postForEntity(anyString(), any(), eq(Map.class)))
                .thenReturn(buildGroqResponse("Here is some advice."));

        assertDoesNotThrow(() -> aiCoachService.chat(request));

        verify(adviceHistoryRepository, times(2)).save(any()); // user + assistant
    }

    // ── Successful chat ───────────────────────────────────────────────────────

    @Test
    void chat_WithValidMessage_ReturnsAssistantResponse() {
        ChatRequest request = TestDataFactory.createValidChatRequest();

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(goalRepository.findByUserId(testUser.getId())).thenReturn(List.of());
        when(expenseRepository.findByUserId(testUser.getId())).thenReturn(List.of());
        when(financialProfileService.getSnapshot(testUser)).thenReturn(mockSnapshot);
        when(adviceHistoryRepository.findTop10ByUserIdOrderByCreatedAtDesc(any()))
                .thenReturn(List.of());
        when(adviceHistoryRepository.save(any())).thenReturn(mock(AdviceHistory.class));
        when(restTemplate.postForEntity(anyString(), any(), eq(Map.class)))
                .thenReturn(buildGroqResponse("Here are some tips to save money."));

        ChatResponse response = aiCoachService.chat(request);

        assertEquals("Here are some tips to save money.", response.getMessage());
        assertEquals("assistant", response.getRole());
        assertNotNull(response.getTimestamp());

        verify(adviceHistoryRepository, times(2)).save(any()); // user + assistant
    }

    @Test
    void chat_SavesBothUserAndAssistantHistoryEntries() {
        ChatRequest request = TestDataFactory.createValidChatRequest();

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(goalRepository.findByUserId(testUser.getId())).thenReturn(List.of());
        when(expenseRepository.findByUserId(testUser.getId())).thenReturn(List.of());
        when(financialProfileService.getSnapshot(testUser)).thenReturn(mockSnapshot);
        when(adviceHistoryRepository.findTop10ByUserIdOrderByCreatedAtDesc(any()))
                .thenReturn(List.of());
        when(adviceHistoryRepository.save(any())).thenReturn(mock(AdviceHistory.class));
        when(restTemplate.postForEntity(anyString(), any(), eq(Map.class)))
                .thenReturn(buildGroqResponse("Some advice."));

        aiCoachService.chat(request);

        // Called twice: once for user message, once for assistant reply
        verify(adviceHistoryRepository, times(2)).save(any(AdviceHistory.class));
    }

    // ── Groq API failure handling ──────────────────────────────────────────────

    @Test
    void chat_WhenGroqApiThrowsRestClientException_ThrowsAIServiceUnavailableException() {
        ChatRequest request = TestDataFactory.createValidChatRequest();

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(goalRepository.findByUserId(testUser.getId())).thenReturn(List.of());
        when(expenseRepository.findByUserId(testUser.getId())).thenReturn(List.of());
        when(financialProfileService.getSnapshot(testUser)).thenReturn(mockSnapshot);
        when(adviceHistoryRepository.findTop10ByUserIdOrderByCreatedAtDesc(any()))
                .thenReturn(List.of());
        when(adviceHistoryRepository.save(any())).thenReturn(mock(AdviceHistory.class));
        when(restTemplate.postForEntity(anyString(), any(), eq(Map.class)))
                .thenThrow(new RestClientException("Connection refused"));

        assertThrows(AIServiceUnavailableException.class, () -> aiCoachService.chat(request));

        // User message should still be saved even if API fails
        verify(adviceHistoryRepository, times(1)).save(any()); // only user message
    }

    @Test
    void chat_WhenGroqReturnsNullBody_ThrowsAIServiceUnavailableException() {
        ChatRequest request = TestDataFactory.createValidChatRequest();

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(goalRepository.findByUserId(testUser.getId())).thenReturn(List.of());
        when(expenseRepository.findByUserId(testUser.getId())).thenReturn(List.of());
        when(financialProfileService.getSnapshot(testUser)).thenReturn(mockSnapshot);
        when(adviceHistoryRepository.findTop10ByUserIdOrderByCreatedAtDesc(any()))
                .thenReturn(List.of());
        when(adviceHistoryRepository.save(any())).thenReturn(mock(AdviceHistory.class));
        when(restTemplate.postForEntity(anyString(), any(), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(null));

        assertThrows(AIServiceUnavailableException.class, () -> aiCoachService.chat(request));

        // User message should still be saved even if API fails
        verify(adviceHistoryRepository, times(1)).save(any()); // only user message
    }

    // ── notifyGoalAction ──────────────────────────────────────────────────────

    @Test
    void notifyGoalAction_CreateGoal_SavesAssistantHistoryEntry() {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(adviceHistoryRepository.save(any())).thenReturn(mock(AdviceHistory.class));

        aiCoachService.notifyGoalAction("CREATE_GOAL", "Japan Trip");

        verify(adviceHistoryRepository).save(argThat(h ->
                h.getRole().equals("assistant") &&
                        h.getMessage().contains("Japan Trip") &&
                        h.getMessage().contains("created")));
    }

    @Test
    void notifyGoalAction_UpdateGoal_SavesUpdateMessage() {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(adviceHistoryRepository.save(any())).thenReturn(mock(AdviceHistory.class));

        aiCoachService.notifyGoalAction("UPDATE_GOAL", "Emergency Fund");

        verify(adviceHistoryRepository).save(argThat(h ->
                h.getMessage().contains("updated")));
    }

    @Test
    void notifyGoalAction_DeleteGoal_SavesDeleteMessage() {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(adviceHistoryRepository.save(any())).thenReturn(mock(AdviceHistory.class));

        aiCoachService.notifyGoalAction("DELETE_GOAL", "Car Fund");

        verify(adviceHistoryRepository).save(argThat(h ->
                h.getMessage().contains("deleted")));
    }

    // ── getWeeklyAdvice ───────────────────────────────────────────────────────

    @Test
    void getWeeklyAdvice_WithUser_ReturnsAdvice() {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(goalRepository.findByUserId(testUser.getId())).thenReturn(List.of());
        when(expenseRepository.findByUserId(testUser.getId())).thenReturn(List.of());
        when(financialProfileService.getSnapshot(testUser)).thenReturn(mockSnapshot);
        when(restTemplate.postForEntity(anyString(), any(), eq(Map.class)))
                .thenReturn(buildGroqResponse("Here's your weekly advice."));
        when(adviceHistoryRepository.save(any())).thenReturn(mock(AdviceHistory.class));

        ChatResponse response = aiCoachService.getWeeklyAdvice();

        assertEquals("Here's your weekly advice.", response.getMessage());
        assertEquals("assistant", response.getRole());
        assertNotNull(response.getTimestamp());

        verify(adviceHistoryRepository, times(1)).save(any()); // only assistant message
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private ResponseEntity<Map> buildGroqResponse(String content) {
        Map<String, Object> message  = Map.of("content", content, "role", "assistant");
        Map<String, Object> choice   = Map.of("message", message);
        Map<String, Object> body     = Map.of("choices", List.of(choice));
        return ResponseEntity.ok(body);
    }
}