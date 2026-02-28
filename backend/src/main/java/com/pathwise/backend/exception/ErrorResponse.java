package com.pathwise.backend.exception;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Standard error response shape for every API error.
 *
 * Example 400 validation error:
 * {
 *   "timestamp": "2025-03-01T10:30:00",
 *   "status": 400,
 *   "error": "Validation Failed",
 *   "message": "One or more fields are invalid.",
 *   "path": "/api/goals",
 *   "fields": {
 *     "targetAmount": "Must be greater than zero",
 *     "deadline": "Deadline must be a future date"
 *   }
 * }
 *
 * Example 409 conflict:
 * {
 *   "timestamp": "2025-03-01T10:30:00",
 *   "status": 409,
 *   "error": "Conflict",
 *   "message": "An account with this email already exists.",
 *   "path": "/api/auth/register"
 * }
 */
@Data
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ErrorResponse {
    private LocalDateTime timestamp;
    private int status;
    private String error;
    private String message;
    private String path;
    private Map<String, String> fields; // only present on validation errors
}