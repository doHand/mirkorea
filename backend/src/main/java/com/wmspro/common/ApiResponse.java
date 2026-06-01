package com.wmspro.common;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Getter;

@Getter
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiResponse<T> {
    private final boolean success;
    private final T       data;
    private final String  code;
    private final String  message;
    private final Object  detail;

    private ApiResponse(boolean success, T data, String code, String message, Object detail) {
        this.success = success;
        this.data    = data;
        this.code    = code;
        this.message = message;
        this.detail  = detail;
    }

    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(true, data, null, null, null);
    }

    public static <T> ApiResponse<T> ok(T data, String message) {
        return new ApiResponse<>(true, data, null, message, null);
    }

    public static ApiResponse<Object> fail(String code, String message, Object detail) {
        return new ApiResponse<>(false, null, code, message, detail);
    }
}
