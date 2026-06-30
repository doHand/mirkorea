package com.wmspro.domain.outbound;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.UUID;

public class PickingCompletionRequest {
    @NotNull @NotEmpty public List<UUID>          orderIds;
    @NotNull @NotEmpty public List<@Valid ItemRequest> items;

    public static class ItemRequest {
        @NotNull public UUID productId;
        @Min(1)  public int  boxCount;
    }
}
