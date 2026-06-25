package com.wmspro.domain.product;

public enum BarcodeUnitType {
    UNIT,
    CXD,
    CXD_OUT;

    public static BarcodeUnitType from(String value) {
        if (value == null || value.isBlank()) return UNIT;
        return switch (value.trim().toUpperCase()) {
            case "BOX", "CXD_BOX", "CXD OUT" -> CXD_OUT;
            case "CXD", "CXD_IN", "CXD IN" -> CXD;
            default -> valueOf(value.trim().toUpperCase());
        };
    }
}
