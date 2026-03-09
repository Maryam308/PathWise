package com.pathwise.backend.exception;

/**
 * Thrown when a user attempts to log in before verifying their email.
 * Maps to HTTP 403 with error code "EMAIL_NOT_VERIFIED" so the frontend
 * can detect it and redirect to the verification step.
 */
public class EmailNotVerifiedException extends RuntimeException {
    public EmailNotVerifiedException(String message) {
        super(message);
    }
}