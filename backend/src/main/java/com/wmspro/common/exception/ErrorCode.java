package com.wmspro.common.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public enum ErrorCode {
    // Auth
    INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED,   "아이디 또는 비밀번호가 올바르지 않습니다"),
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED,           "인증이 필요합니다"),
    FORBIDDEN(HttpStatus.FORBIDDEN,                 "접근 권한이 없습니다"),

    // Stock
    INSUFFICIENT_STOCK(HttpStatus.CONFLICT,         "출고 가능 재고가 부족합니다"),
    STOCK_NEGATIVE(HttpStatus.CONFLICT,             "재고 음수 방지: 처리 불가"),
    STOCK_INTEGRITY_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "재고 정합성 오류"),
    ALREADY_CANCELLED(HttpStatus.CONFLICT,          "이미 취소된 거래입니다"),
    CANNOT_CANCEL(HttpStatus.CONFLICT,              "이미 출고된 수량이 있어 취소 불가합니다"),
    INVALID_TX_TYPE(HttpStatus.BAD_REQUEST,         "해당 거래 유형은 취소할 수 없습니다"),

    // Entity
    PRODUCT_NOT_FOUND(HttpStatus.NOT_FOUND,         "상품을 찾을 수 없습니다"),
    PRODUCT_CODE_DUPLICATE(HttpStatus.CONFLICT,     "상품코드가 이미 존재합니다"),
    BARCODE_NOT_FOUND(HttpStatus.NOT_FOUND,         "바코드를 찾을 수 없습니다"),
    BARCODE_DUPLICATE(HttpStatus.CONFLICT,          "이미 등록된 바코드입니다"),
    INVENTORY_NOT_FOUND(HttpStatus.NOT_FOUND,       "해당 위치에 재고가 없습니다"),
    TRANSACTION_NOT_FOUND(HttpStatus.NOT_FOUND,     "거래 내역을 찾을 수 없습니다"),
    WAREHOUSE_NOT_FOUND(HttpStatus.NOT_FOUND,       "창고를 찾을 수 없습니다"),
    WAREHOUSE_CODE_DUPLICATE(HttpStatus.CONFLICT,   "창고코드가 이미 존재합니다"),
    LOCATION_NOT_FOUND(HttpStatus.NOT_FOUND,        "위치를 찾을 수 없습니다"),
    LOCATION_CODE_DUPLICATE(HttpStatus.CONFLICT,    "위치코드가 이미 존재합니다"),
    USER_NOT_FOUND(HttpStatus.NOT_FOUND,            "사용자를 찾을 수 없습니다"),
    USER_DUPLICATE(HttpStatus.CONFLICT,             "이미 존재하는 사용자명입니다"),

    // General
    INVALID_REQUEST(HttpStatus.BAD_REQUEST,         "잘못된 요청입니다"),
    SAME_LOCATION(HttpStatus.BAD_REQUEST,           "출발지와 목적지가 동일합니다"),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR,"서버 내부 오류가 발생했습니다");

    private final HttpStatus status;
    private final String message;

    ErrorCode(HttpStatus status, String message) {
        this.status  = status;
        this.message = message;
    }
}
