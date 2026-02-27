package com.pathwise.backend.enums;

public enum BahrainBank {
    NBB("National Bank of Bahrain"),
    BBK("Bank of Bahrain and Kuwait"),
    AHLI_UNITED("Ahli United Bank"),
    ITHMAAR("Ithmaar Bank"),
    KHALEEJI("Khaleeji Commercial Bank"),
    AL_SALAM("Al Salam Bank"),
    GULF_INTERNATIONAL("Gulf International Bank"),
    CITIBANK("Citibank Bahrain"),
    HSBC("HSBC Bahrain"),
    STANDARD_CHARTERED("Standard Chartered Bahrain"),
    BFC("BFC Bank"),
    ARAB_BANKING("Arab Banking Corporation"),
    FIRST_ABU_DHABI("First Abu Dhabi Bank Bahrain"),
    BANK_ABC("Bank ABC");

    private final String displayName;

    BahrainBank(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }
}