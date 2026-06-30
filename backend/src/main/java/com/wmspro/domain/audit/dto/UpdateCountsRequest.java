package com.wmspro.domain.audit.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.util.List;
import java.util.UUID;

@Getter @Setter
public class UpdateCountsRequest {

    @NotNull private List<@Valid ItemCount> counts;

    @Getter @Setter
    public static class ItemCount {
        @NotNull public UUID    itemId;
                 public Integer countedQty;  // null = 미입력으로 초기화
    }
}
