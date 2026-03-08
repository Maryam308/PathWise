package com.pathwise.backend.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.*;

@Target({ElementType.FIELD})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = FutureYearMonthValidator.class)
public @interface FutureYearMonth {
    String message() default "Deadline must be a future date";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}