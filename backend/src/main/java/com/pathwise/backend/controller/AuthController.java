package com.pathwise.backend.controller;

import com.pathwise.backend.dto.*;
import com.pathwise.backend.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Tag(name = "Authentication", description = "Registration, login, email verification, and password reset")
public class AuthController {

    private final AuthService authService;

    // ── Register ──────────────────────────────────────────────────────────────

    @PostMapping("/register")
    @Operation(summary = "Register a new user",
            description = "Creates the account and sends a 6-digit email verification code. No JWT is returned here.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Account created — verification email sent"),
            @ApiResponse(responseCode = "400", description = "Validation error"),
            @ApiResponse(responseCode = "409", description = "Email or phone already registered")
    })
    public ResponseEntity<MessageResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.register(request));
    }

    // ── Email verification ─────────────────────────────────────────────────────

    @PostMapping("/verify-email")
    @Operation(summary = "Verify email address",
            description = "Validates the 6-digit OTP sent at registration. Returns a JWT on success.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Email verified — JWT returned"),
            @ApiResponse(responseCode = "400", description = "Invalid or expired code")
    })
    public ResponseEntity<AuthResponse> verifyEmail(@Valid @RequestBody VerifyEmailRequest request) {
        return ResponseEntity.ok(authService.verifyEmail(request));
    }

    @PostMapping("/resend-verification")
    @Operation(summary = "Resend email verification code",
            description = "Issues a new OTP and invalidates the previous one. Rate-limit this endpoint in production.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "New code sent"),
            @ApiResponse(responseCode = "400", description = "Email not found or already verified")
    })
    public ResponseEntity<MessageResponse> resendVerification(@Valid @RequestBody ResendCodeRequest request) {
        return ResponseEntity.ok(authService.resendVerification(request));
    }

    // ── Login ─────────────────────────────────────────────────────────────────

    @PostMapping("/login")
    @Operation(summary = "Login",
            description = "Authenticates credentials and returns a JWT. Returns 403 EMAIL_NOT_VERIFIED if the account has not been verified.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Login successful — JWT returned"),
            @ApiResponse(responseCode = "401", description = "Invalid credentials"),
            @ApiResponse(responseCode = "403", description = "Email not verified")
    })
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    // ── Password reset ─────────────────────────────────────────────────────────

    @PostMapping("/forgot-password")
    @Operation(summary = "Request password reset",
            description = "Sends a 6-digit reset code to the email. Always returns 200 — never reveals whether the email is registered.")
    @ApiResponse(responseCode = "200", description = "Reset code sent (or silently ignored if email not found)")
    public ResponseEntity<MessageResponse> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        return ResponseEntity.ok(authService.forgotPassword(request));
    }

    @PostMapping("/verify-reset-code")
    @Operation(summary = "Verify password reset code",
            description = "Validates the 6-digit OTP. Returns a short-lived one-use resetToken on success.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Code valid — resetToken returned"),
            @ApiResponse(responseCode = "400", description = "Invalid or expired code")
    })
    public ResponseEntity<ResetTokenResponse> verifyResetCode(@Valid @RequestBody VerifyResetCodeRequest request) {
        return ResponseEntity.ok(authService.verifyResetCode(request));
    }

    @PostMapping("/reset-password")
    @Operation(summary = "Reset password",
            description = "Sets a new password using the resetToken obtained from /verify-reset-code.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Password updated"),
            @ApiResponse(responseCode = "400", description = "Invalid, expired, or already-used resetToken")
    })
    public ResponseEntity<MessageResponse> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        return ResponseEntity.ok(authService.resetPassword(request));
    }
}