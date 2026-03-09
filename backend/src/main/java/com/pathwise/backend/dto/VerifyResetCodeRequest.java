package com.pathwise.backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class VerifyResetCodeRequest {

    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    private String email;

    @NotBlank(message = "Reset code is required")
    @Pattern(regexp = "^[0-9]{6}$", message = "Code must be exactly 6 digits")
    private String code;
}