package com.pathwise.backend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

/**
 * Sends transactional emails asynchronously so auth endpoints don't block
 * waiting for SMTP delivery.
 *
 * Required application.yaml keys (prod profile):
 *   spring:
 *     mail:
 *       host:     smtp.sendgrid.net          # or smtp.mailgun.org
 *       port:     587
 *       username: apikey                     # SendGrid literal string "apikey"
 *       password: ${SENDGRID_API_KEY}
 *       properties:
 *         mail.smtp.auth: true
 *         mail.smtp.starttls.enable: true
 *   app:
 *     mail:
 *       from: noreply@pathwise.app
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${app.mail.from:noreply@pathwise.app}")
    private String fromAddress;

    // ── Email verification ────────────────────────────────────────────────────

    @Async
    public void sendVerificationEmail(String toEmail, String fullName, String code) {
        String subject = "PathWise — verify your email address";
        String body = String.format("""
                Hi %s,

                Welcome to PathWise! Please verify your email address by entering the code below:

                    %s

                This code expires in 15 minutes. If you did not create a PathWise account, you can safely ignore this email.

                — The PathWise Team
                """, fullName, code);
        send(toEmail, subject, body);
    }

    // ── Password reset ────────────────────────────────────────────────────────

    @Async
    public void sendPasswordResetEmail(String toEmail, String fullName, String code) {
        String subject = "PathWise — password reset code";
        String body = String.format("""
                Hi %s,

                We received a request to reset your PathWise password. Enter the code below to continue:

                    %s

                This code expires in 15 minutes. If you did not request a password reset, please ignore this email — your password has not been changed.

                — The PathWise Team
                """, fullName, code);
        send(toEmail, subject, body);
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    private void send(String to, String subject, String body) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromAddress);
            message.setTo(to);
            message.setSubject(subject);
            message.setText(body);
            mailSender.send(message);
            log.info("Email sent to {} — subject: {}", to, subject);
        } catch (Exception e) {
            // Log but don't propagate — a failed email should not roll back the transaction
            log.error("Failed to send email to {} — {}", to, e.getMessage(), e);
        }
    }
}