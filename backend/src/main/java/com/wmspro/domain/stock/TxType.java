package com.wmspro.domain.stock;

public enum TxType {
    INBOUND,          // 입고
    INBOUND_CANCEL,   // 입고 취소
    OUTBOUND,         // 출고
    OUTBOUND_CANCEL,  // 출고 취소
    ADJUST_INCREASE,  // 재고 증가 조정
    ADJUST_DECREASE,  // 재고 감소 조정
    MOVE_OUT,         // 위치 이동 출발
    MOVE_IN,          // 위치 이동 도착
    INITIAL           // 초기 재고
}
