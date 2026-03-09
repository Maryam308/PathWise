package com.pathwise.backend.exception;

/**
 * Thrown when an OTP or resetToken is missing, expired, already used,
 * or does not match. Maps to HTTP 400.
 */
public class InvalidTokenException extends RuntimeException {
    public InvalidTokenException(String message) {
        super(message);
    }
}