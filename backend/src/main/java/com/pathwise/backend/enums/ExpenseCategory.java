package com.pathwise.backend.enums;

/**
 * Categories for the user's fixed monthly expenses, declared at registration.
 * These are RECURRING, PREDICTABLE costs — not variable Plaid transactions.
 */
public enum ExpenseCategory {
    HOUSING,        // rent, mortgage
    TRANSPORT,      // car loan, fuel estimate
    UTILITIES,      // electricity, internet, water
    FOOD,           // grocery budget
    HEALTHCARE,     // insurance premium, medication
    EDUCATION,      // school/uni fees
    SUBSCRIPTIONS,  // Netflix, Shahid, gym
    FAMILY,         // dependant allowances, remittances
    INSURANCE,      // life/car insurance
    OTHER
}