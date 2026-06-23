package com.wmspro.domain.inbound.dto;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import com.wmspro.domain.product.UnitType;

public class CreateInboundOrderRequest {
    public UUID warehouseId;
    public String supplier;
    public LocalDate expectedDate;
    public String memo;
    public List<ItemRequest> items;

    public static class ItemRequest {
        public UUID productId;
        public int expectedQty;
        public UnitType inputUnit = UnitType.EA;
        public String lotNumber;
        public LocalDate expireDate;
        public UUID locationId;
    }
}
