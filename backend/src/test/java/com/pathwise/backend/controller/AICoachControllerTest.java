package com.pathwise.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pathwise.backend.config.TestDataFactory;
import com.pathwise.backend.config.TestSecurityConfig;
import com.pathwise.backend.dto.ChatRequest;
import com.pathwise.backend.dto.ChatResponse;
import com.pathwise.backend.exception.MessageTooLongException;
import com.pathwise.backend.service.AICoachService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AICoachController.class)
@Import({TestSecurityConfig.class, TestDataFactory.class})
@TestPropertySource(properties = {"groq.api.key=test-key"})
class AICoachControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private AICoachService aiCoachService;

    private ChatRequest chatRequest;
    private ChatResponse chatResponse;

    @BeforeEach
    void setUp() {
        chatRequest = TestDataFactory.createValidChatRequest();
        chatResponse = TestDataFactory.createChatResponse();
    }

    @Test
    @WithMockUser
    void sendMessage_WithValidData_ReturnsOk() throws Exception {
        // Use .chat() — the actual method on AICoachService
        when(aiCoachService.chat(any(ChatRequest.class))).thenReturn(chatResponse);

        mockMvc.perform(post("/api/ai-coach/chat")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(chatRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").exists());
    }

    @Test
    @WithMockUser
    void sendMessage_WithEmptyMessage_ReturnsBadRequest() throws Exception {
        chatRequest.setMessage("");

        mockMvc.perform(post("/api/ai-coach/chat")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(chatRequest)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser
    void sendMessage_WithTooLongMessage_ReturnsBadRequest() throws Exception {
        when(aiCoachService.chat(any(ChatRequest.class)))
                .thenThrow(new MessageTooLongException("Message too long"));

        mockMvc.perform(post("/api/ai-coach/chat")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(chatRequest)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void sendMessage_WithoutAuth_ReturnsUnauthorized() throws Exception {
        mockMvc.perform(post("/api/ai-coach/chat")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(chatRequest)))
                .andExpect(status().isUnauthorized());
    }
}