package com.wmspro.domain.user;

public enum UserRole {
    ADMIN,    // 전체 권한
    MANAGER,  // 관리자 (취소 가능)
    WORKER,   // 작업자 (입출고 처리)
    VIEWER    // 조회 전용
}
