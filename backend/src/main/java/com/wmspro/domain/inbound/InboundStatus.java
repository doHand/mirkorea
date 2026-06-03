package com.wmspro.domain.inbound;

public enum InboundStatus {
    PENDING,      // 입고 예정
    RECEIVING,    // 수령 중 (바코드 스캔)
    INSPECTING,   // 검수 중
    COMPLETED,    // 완료 (재고 자동 증가)
    CANCELLED     // 취소
}
