package com.pathwise.backend.model;

import com.pathwise.backend.enums.TokenPurpose;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Stores one-time 6-digit OTP codes for:
 *   - EMAIL_VERIFICATION  → sent after registration, verified before login is allowed
 *   - PASSWORD_RESET      → sent on forgot-password request, exchanged for a resetToken
 *
 * Only one active token per (user, purpose) is kept at a time.
 * Old tokens are invalidated (used=true) when a new one is issued via resend.
 */
@Entity
@Table(name = "email_verification_tokens", indexes = {
        @Index(name = "idx_evt_user_purpose", columnList = "user_id, purpose"),
        @Index(name = "idx_evt_email_purpose", columnList = "email, purpose")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EmailVerificationToken {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** Denormalised email — lets us look up tokens for unverified users who have no session. */
    @Column(nullable = false)
    private String email;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** The 6-digit code shown in the email. */
    @Column(nullable = false, length = 6)
    private String code;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TokenPurpose purpose;

    /** Expiry timestamp. Codes are valid for 15 minutes. */
    @Column(nullable = false)
    private LocalDateTime expiresAt;

    /**
     * One-use reset token returned after OTP is verified (PASSWORD_RESET flow only).
     * Frontend sends this back with the new password.
     * Valid for 10 minutes after OTP verification.
     */
    @Column(unique = true)
    private String resetToken;

    @Column(nullable = false)
    @Builder.Default
    private boolean used = false;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
}