package com.pathwise.backend.controller;

import com.pathwise.backend.dto.*;
import com.pathwise.backend.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Tag(name = "Authentication", description = "User registration, email verification, and login endpoints")
public class AuthController {

    private final AuthService authService;

    // ── POST /api/auth/register ───────────────────────────────────────────────

    @PostMapping("/register")
    @Operation(
            summary = "Register a new user",
            description = "Creates a new user account and sends a 6-digit OTP to the provided email. " +
                    "The account cannot be used until the email is verified via /verify-email."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Registration successful — verification email sent",
                    content = @Content(mediaType = "application/json", schema = @Schema(implementation = MessageResponse.class))),
            @ApiResponse(responseCode = "400", description = "Invalid input data"),
            @ApiResponse(responseCode = "409", description = "Email already registered"),
            @ApiResponse(responseCode = "500", description = "Internal server error")
    })
    public ResponseEntity<MessageResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.register(request));
    }

    // ── POST /api/auth/verify-email ───────────────────────────────────────────

    @PostMapping("/verify-email")
    @Operation(
            summary = "Verify email with OTP",
            description = "Validates the 6-digit OTP sent during registration and returns a JWT token."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Email verified — JWT token returned",
                    content = @Content(mediaType = "application/json", schema = @Schema(implementation = AuthResponse.class))),
            @ApiResponse(responseCode = "400", description = "Invalid or expired OTP")
    })
    public ResponseEntity<AuthResponse> verifyEmail(@Valid @RequestBody VerifyEmailRequest request) {
        return ResponseEntity.ok(authService.verifyEmail(request));
    }

    // ── POST /api/auth/resend-verification ────────────────────────────────────

    @PostMapping("/resend-verification")
    @Operation(
            summary = "Resend verification OTP",
            description = "Issues a new 6-digit OTP and invalidates the previous one."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "New OTP sent"),
            @ApiResponse(responseCode = "400", description = "Invalid request")
    })
    public ResponseEntity<MessageResponse> resendVerification(@Valid @RequestBody ResendCodeRequest request) {
        return ResponseEntity.ok(authService.resendVerification(request));
    }

    // ── POST /api/auth/login ──────────────────────────────────────────────────

    @PostMapping("/login")
    @Operation(
            summary = "Login",
            description = "Authenticates credentials and returns a JWT token. " +
                    "Returns 403 EMAIL_NOT_VERIFIED if the email has not been verified."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Login successful — JWT returned",
                    content = @Content(mediaType = "application/json", schema = @Schema(implementation = AuthResponse.class))),
            @ApiResponse(responseCode = "401", description = "Invalid credentials"),
            @ApiResponse(responseCode = "403", description = "Email not verified")
    })
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    // ── POST /api/auth/forgot-password ────────────────────────────────────────

    @PostMapping("/forgot-password")
    @Operation(
            summary = "Request a password reset OTP",
            description = "Sends a 6-digit reset OTP if the email is registered. " +
                    "Always returns 200 to prevent email enumeration."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Reset code sent (if email exists)"),
            @ApiResponse(responseCode = "400", description = "Invalid email format")
    })
    public ResponseEntity<MessageResponse> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        return ResponseEntity.ok(authService.forgotPassword(request));
    }

    // ── POST /api/auth/verify-reset-code ─────────────────────────────────────

    @PostMapping("/verify-reset-code")
    @Operation(
            summary = "Verify password reset OTP",
            description = "Validates the 6-digit reset OTP and returns a short-lived resetToken."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "OTP valid — resetToken returned",
                    content = @Content(mediaType = "application/json", schema = @Schema(implementation = ResetTokenResponse.class))),
            @ApiResponse(responseCode = "400", description = "Invalid or expired OTP")
    })
    public ResponseEntity<ResetTokenResponse> verifyResetCode(@Valid @RequestBody VerifyResetCodeRequest request) {
        return ResponseEntity.ok(authService.verifyResetCode(request));
    }

    // ── POST /api/auth/reset-password ────────────────────────────────────────

    @PostMapping("/reset-password")
    @Operation(
            summary = "Reset password",
            description = "Sets a new password using the resetToken from /verify-reset-code. Single-use."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Password updated"),
            @ApiResponse(responseCode = "400", description = "Invalid or expired resetToken")
    })
    public ResponseEntity<MessageResponse> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        return ResponseEntity.ok(authService.resetPassword(request));
    }
}