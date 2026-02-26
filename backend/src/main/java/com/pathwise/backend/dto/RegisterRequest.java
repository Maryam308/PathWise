package com.pathwise.backend.dto;

import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RegisterRequest {

    @NotBlank(message = "Full name is required")
    @Pattern(regexp = "^[a-zA-Z]+(?:\\s[a-zA-Z]+)+$",
            message = "Full name must contain at least first and last name with only letters")
    @Size(min = 3, max = 50, message = "Full name must be between 3 and 50 characters")
    private String fullName;

    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    private String email;

    @NotBlank(message = "Password is required")
    @Size(min = 6, message = "Password must be at least 6 characters")
    private String password;

    
    @NotBlank(message = "Phone number is required")
    @Pattern(regexp = "^\\+9733[2-9]\\d{6}$|^\\+9736[0-9]\\d{6}$|^\\+9733[0-9]\\d{6}$",
            message = "Must be a valid Bahrain phone number (e.g. +97333123456 or +97366123456)")
    private String phone;
}