package com.pathwise.backend.config;

import com.pathwise.backend.security.JwtUtil;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@TestConfiguration
public class TestJwtConfig {

    @Bean
    @Primary
    public JwtUtil jwtUtil() {
        JwtUtil mockJwtUtil = mock(JwtUtil.class);

        // JwtUtil public API:
        //   generateToken(String email)  → String
        //   extractEmail(String token)   → String
        //   isTokenValid(String token, String email) → boolean
        // Note: isTokenExpired() is private — never mock it directly

        when(mockJwtUtil.generateToken(anyString())).thenReturn("test-jwt-token");
        when(mockJwtUtil.extractEmail(anyString())).thenReturn("test@example.com");
        when(mockJwtUtil.isTokenValid(anyString(), anyString())).thenReturn(true);

        return mockJwtUtil;
    }
}