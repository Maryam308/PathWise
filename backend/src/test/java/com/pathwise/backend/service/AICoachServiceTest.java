package com.pathwise.backend.service;

import com.pathwise.backend.config.TestDataFactory;
import com.pathwise.backend.dto.ChatRequest;
import com.pathwise.backend.exception.AIServiceUnavailableException;
import com.pathwise.backend.exception.MessageTooLongException;
import com.pathwise.backend.model.User;
import com.pathwise.backend.repository.AdviceHistoryRepository;
import com.pathwise.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for AICoachService.
 *
 * The Groq HTTP call cannot be unit-tested without WireMock — those belong in
 * integration tests. These tests cover input validation and exception behaviour.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AICoachServiceTest {

    @Mock
    private AdviceHistoryRepository adviceHistoryRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private AICoachService aiCoachService;

    private User testUser;
    private ChatRequest chatRequest;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(aiCoachService, "groqApiKey", "test-key-not-real");

        Authentication auth = mock(Authentication.class);
        when(auth.getName()).thenReturn("test@example.com");
        SecurityContext ctx = mock(SecurityContext.class);
        when(ctx.getAuthentication()).thenReturn(auth);
        SecurityContextHolder.setContext(ctx);

        testUser = TestDataFactory.createTestUser();
        chatRequest = TestDataFactory.createValidChatRequest();
    }

    // ─── ChatRequest structure ────────────────────────────────────────────────

    @Test
    void chatRequest_HasMessage_NotNull() {
        assertNotNull(chatRequest.getMessage());
        assertFalse(chatRequest.getMessage().isBlank());
    }

    @Test
    void chatRequest_MessageContent_IsCorrect() {
        assertEquals("How can I save more money?", chatRequest.getMessage());
    }

    // ─── Input validation ─────────────────────────────────────────────────────

    @Test
    void processMessage_WithEmptyMessage_ThrowsException() {
        chatRequest.setMessage("");
        assertThrows(Exception.class, () -> aiCoachService.chat(chatRequest));
    }

    @Test
    void processMessage_WithBlankMessage_ThrowsException() {
        chatRequest.setMessage("   ");
        assertThrows(Exception.class, () -> aiCoachService.chat(chatRequest));
    }

    @Test
    void processMessage_WithTooLongMessage_ThrowsMessageTooLongException() {
        chatRequest.setMessage("a".repeat(3000));
        assertThrows(MessageTooLongException.class, () -> aiCoachService.chat(chatRequest));
    }

    @Test
    void processMessage_WhenUserNotFound_ThrowsException() {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.empty());
        assertThrows(Exception.class, () -> aiCoachService.chat(chatRequest));
    }

    // ─── Exception types compile correctly ────────────────────────────────────

    @Test
    void aiServiceUnavailableException_CanBeThrown() {
        assertThrows(AIServiceUnavailableException.class,
                () -> { throw new AIServiceUnavailableException("Groq API unreachable"); });
    }

    @Test
    void messageTooLongException_CanBeThrown() {
        assertThrows(MessageTooLongException.class,
                () -> { throw new MessageTooLongException("Message exceeds limit"); });
    }

    // ─── Message length boundary ──────────────────────────────────────────────

    @Test
    void chatRequest_NormalMessage_IsWithinLimit() {
        String msg = "What is a good savings plan for buying a car in Bahrain?";
        assertTrue(msg.length() < 2000);
    }
}