package com.wmspro.domain.audit.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.List;
import java.util.UUID;

@Getter @Setter
public class UpdateCountsRequest {

    private List<ItemCount> counts;

    @Getter @Setter
    public static class ItemCount {
        public UUID    itemId;
        public Integer countedQty;  // null = 미입력으로 초기화
    }
}
