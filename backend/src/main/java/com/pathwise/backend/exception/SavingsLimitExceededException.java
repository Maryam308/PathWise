package com.pathwise.backend.exception;
public class SavingsLimitExceededException extends RuntimeException {
    public SavingsLimitExceededException(String message) { super(message); }
}
