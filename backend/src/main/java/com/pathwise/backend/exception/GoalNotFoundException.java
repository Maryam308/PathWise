package com.pathwise.backend.exception;
public class GoalNotFoundException extends RuntimeException {
    public GoalNotFoundException(String message) { super(message); }
}