package com.wmspro.domain.inbound.dto;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public class CreateInboundOrderRequest {
    public UUID warehouseId;
    public String supplier;
    public LocalDate expectedDate;
    public String memo;
    public List<ItemRequest> items;

    public static class ItemRequest {
        public UUID productId;
        public int expectedQty;
        public String lotNumber;
        public LocalDate expireDate;
        public UUID locationId;
    }
}
