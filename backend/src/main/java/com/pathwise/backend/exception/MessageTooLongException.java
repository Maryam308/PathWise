package com.pathwise.backend.exception;

public class MessageTooLongException extends RuntimeException {
    public MessageTooLongException(String message) {
        super(message);
    }
}