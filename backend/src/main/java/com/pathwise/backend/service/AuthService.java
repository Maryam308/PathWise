package com.pathwise.backend.service;

import com.pathwise.backend.exception.EmailAlreadyExistsException;
import com.pathwise.backend.exception.InvalidCredentialsException;
import com.pathwise.backend.exception.UserNotFoundException;
import com.pathwise.backend.dto.AuthResponse;
import com.pathwise.backend.dto.LoginRequest;
import com.pathwise.backend.dto.RegisterRequest;
import com.pathwise.backend.model.User;
import com.pathwise.backend.repository.UserRepository;
import com.pathwise.backend.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class AuthService implements UserDetailsService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public AuthResponse register(RegisterRequest request) {
        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new EmailAlreadyExistsException("Email already exists");
        }

        User user = User.builder()
                .fullName(request.getFullName())
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .preferredCurrency("BHD")
                .createdAt(LocalDateTime.now())
                .build();

        User saved = userRepository.save(user);
        String token = jwtUtil.generateToken(saved.getEmail());

        return new AuthResponse(token, saved.getEmail(),
                saved.getFullName(), saved.getId());
    }

    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new UserNotFoundException("User not found"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new InvalidCredentialsException("Invalid email or password");
        }

        String token = jwtUtil.generateToken(user.getEmail());

        return new AuthResponse(token, user.getEmail(),
                user.getFullName(), user.getId());
    }

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UserNotFoundException("User not found"));

        return org.springframework.security.core.userdetails.User
                .withUsername(user.getEmail())
                .password(user.getPasswordHash())
                .authorities("USER")
                .build();
    }
}