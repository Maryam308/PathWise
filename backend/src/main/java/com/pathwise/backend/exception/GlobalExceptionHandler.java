package com.pathwise.backend.exception;

import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    // ── 400 — @Valid field validation failures ────────────────────────────────
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(
            MethodArgumentNotValidException ex, HttpServletRequest req) {

        Map<String, String> fields = new LinkedHashMap<>();
        ex.getBindingResult().getFieldErrors()
                .forEach(e -> fields.put(e.getField(), e.getDefaultMessage()));

        return build(HttpStatus.BAD_REQUEST, "Validation Failed",
                "One or more fields are invalid.", req, fields);
    }

    // ── 400 — Wrong type in path variable (e.g. non-UUID) ────────────────────
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponse> handleTypeMismatch(
            MethodArgumentTypeMismatchException ex, HttpServletRequest req) {

        String message = String.format(
                "Invalid value '%s' for parameter '%s'. Expected type: %s.",
                ex.getValue(), ex.getName(),
                ex.getRequiredType() != null ? ex.getRequiredType().getSimpleName() : "unknown");

        return build(HttpStatus.BAD_REQUEST, "Bad Request", message, req, null);
    }

    // ── 400 — Chat message too long ───────────────────────────────────────────
    @ExceptionHandler(MessageTooLongException.class)
    public ResponseEntity<ErrorResponse> handleMessageTooLong(
            MessageTooLongException ex, HttpServletRequest req) {
        return build(HttpStatus.BAD_REQUEST, "Message Too Long", ex.getMessage(), req, null);
    }

    // ── 400 — Expense data business-rule violation ────────────────────────────
    @ExceptionHandler(InvalidExpenseDataException.class)
    public ResponseEntity<ErrorResponse> handleInvalidExpense(
            InvalidExpenseDataException ex, HttpServletRequest req) {
        return build(HttpStatus.BAD_REQUEST, "Invalid Expense Data", ex.getMessage(), req, null);
    }

    // ── 401 — Wrong email or password ────────────────────────────────────────
    @ExceptionHandler(InvalidCredentialsException.class)
    public ResponseEntity<ErrorResponse> handleInvalidCredentials(
            InvalidCredentialsException ex, HttpServletRequest req) {
        return build(HttpStatus.UNAUTHORIZED, "Unauthorized", ex.getMessage(), req, null);
    }

    // ── 403 — Authenticated but accessing another user's resource ────────────
    @ExceptionHandler({UnauthorizedAccessException.class, AccessDeniedException.class})
    public ResponseEntity<ErrorResponse> handleForbidden(
            RuntimeException ex, HttpServletRequest req) {
        // Never expose the internal reason — just "forbidden"
        return build(HttpStatus.FORBIDDEN, "Forbidden",
                "You do not have permission to access this resource.", req, null);
    }

    // ── 404 — Goal or User not found ─────────────────────────────────────────
    @ExceptionHandler({GoalNotFoundException.class, UserNotFoundException.class})
    public ResponseEntity<ErrorResponse> handleNotFound(
            RuntimeException ex, HttpServletRequest req) {
        return build(HttpStatus.NOT_FOUND, "Not Found", ex.getMessage(), req, null);
    }

    // ── 409 — Email already registered ───────────────────────────────────────
    @ExceptionHandler(EmailAlreadyExistsException.class)
    public ResponseEntity<ErrorResponse> handleEmailExists(
            EmailAlreadyExistsException ex, HttpServletRequest req) {
        return build(HttpStatus.CONFLICT, "Conflict", ex.getMessage(), req, null);
    }

    // ── 422 — Savings target would exceed disposable income ──────────────────
    // 422 Unprocessable Entity: request is valid JSON but violates a business rule.
    @ExceptionHandler(SavingsLimitExceededException.class)
    public ResponseEntity<ErrorResponse> handleSavingsLimit(
            SavingsLimitExceededException ex, HttpServletRequest req) {
        return build(HttpStatus.UNPROCESSABLE_ENTITY, "Savings Limit Exceeded",
                ex.getMessage(), req, null);
    }

    // ── 503 — Groq / AI service unavailable ──────────────────────────────────
    @ExceptionHandler(AIServiceUnavailableException.class)
    public ResponseEntity<ErrorResponse> handleAIUnavailable(
            AIServiceUnavailableException ex, HttpServletRequest req) {
        return build(HttpStatus.SERVICE_UNAVAILABLE, "Service Unavailable",
                ex.getMessage(), req, null);
    }

    // ── 500 — Catch-all: log full trace, never expose internals ──────────────
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGeneric(
            Exception ex, HttpServletRequest req) {
        log.error("Unhandled exception at [{}] {}: {}",
                req.getMethod(), req.getRequestURI(), ex.getMessage(), ex);
        return build(HttpStatus.INTERNAL_SERVER_ERROR, "Internal Server Error",
                "An unexpected error occurred. Please try again later.", req, null);
    }

    // ── Builder ───────────────────────────────────────────────────────────────
    private ResponseEntity<ErrorResponse> build(
            HttpStatus status, String error, String message,
            HttpServletRequest req, Map<String, String> fields) {

        return ResponseEntity.status(status).body(ErrorResponse.builder()
                .timestamp(LocalDateTime.now())
                .status(status.value())
                .error(error)
                .message(message)
                .path(req.getRequestURI())
                .fields(fields)
                .build());
    }
}