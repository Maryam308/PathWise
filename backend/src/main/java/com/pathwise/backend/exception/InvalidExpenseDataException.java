package com.pathwise.backend.exception;
public class InvalidExpenseDataException extends RuntimeException {
    public InvalidExpenseDataException(String message) { super(message); }
}
