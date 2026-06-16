package com.wmspro.domain.outbound;

import java.util.List;
import java.util.UUID;

public class PickingCompletionRequest {
    public List<UUID> orderIds;
    public List<ItemRequest> items;

    public static class ItemRequest {
        public UUID productId;
        public int boxCount;
    }
}
