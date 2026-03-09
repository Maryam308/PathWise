// src/test/java/com/pathwise/backend/config/TestSecurityConfig.java
package com.pathwise.backend.config;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import com.pathwise.backend.security.JwtAuthFilter;
import org.springframework.context.annotation.Import;
import com.pathwise.backend.security.JwtUtil;

@TestConfiguration
@EnableWebSecurity
@Import(TestJwtConfig.class)
public class TestSecurityConfig {

    // Provide a mock JwtUtil so JwtAuthFilter can be constructed
    @MockitoBean
    public JwtUtil jwtUtil;

    // Provide a mock JwtAuthFilter — replaces the real one so no JWT processing happens
    @MockitoBean
    public JwtAuthFilter jwtAuthFilter;

    @Bean
    public SecurityFilterChain testSecurityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint((request, response, authException) ->
                                response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Unauthorized"))
                )
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/auth/**", "/api/auth/**", "/h2-console/**").permitAll()
                        .anyRequest().authenticated()
                )
                .headers(headers ->
                        headers.frameOptions(frameOptions -> frameOptions.disable()));

        return http.build();
    }

    @Bean
    public UserDetailsService testUserDetailsService() {
        return new InMemoryUserDetailsManager(
                User.builder()
                        .username("test@example.com")
                        .password("{noop}password")
                        .roles("USER")
                        .build(),
                User.builder()
                        .username("other@example.com")
                        .password("{noop}password")
                        .roles("USER")
                        .build()
        );
    }
}