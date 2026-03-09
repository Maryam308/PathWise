package com.pathwise.backend.repository;

import com.pathwise.backend.enums.TokenPurpose;
import com.pathwise.backend.model.EmailVerificationToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface EmailVerificationTokenRepository extends JpaRepository<EmailVerificationToken, UUID> {

    /** Find the most recent unused, unexpired token for a given email + purpose. */
    @Query("""
        SELECT t FROM EmailVerificationToken t
        WHERE t.email = :email
          AND t.purpose = :purpose
          AND t.used = false
          AND t.expiresAt > CURRENT_TIMESTAMP
        ORDER BY t.createdAt DESC
        LIMIT 1
    """)
    Optional<EmailVerificationToken> findActiveToken(String email, TokenPurpose purpose);

    /** Find by the one-use resetToken UUID string (PASSWORD_RESET flow, step 2). */
    @Query("""
        SELECT t FROM EmailVerificationToken t
        WHERE t.resetToken = :resetToken
          AND t.purpose = 'PASSWORD_RESET'
          AND t.used = false
          AND t.expiresAt > CURRENT_TIMESTAMP
    """)
    Optional<EmailVerificationToken> findActiveResetToken(String resetToken);

    /** Invalidate all previous tokens for this email + purpose before issuing a new one. */
    @Modifying
    @Query("""
        UPDATE EmailVerificationToken t
        SET t.used = true
        WHERE t.email = :email
          AND t.purpose = :purpose
          AND t.used = false
    """)
    void invalidateAll(String email, TokenPurpose purpose);
}