package com.pathwise.backend.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.time.YearMonth;

public class FutureYearMonthValidator implements ConstraintValidator<FutureYearMonth, YearMonth> {
    @Override
    public boolean isValid(YearMonth value, ConstraintValidatorContext context) {
        if (value == null) {
            return true; // Let @NotNull handle null if needed
        }
        return value.isAfter(YearMonth.now());
    }
}