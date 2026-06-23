package com.wmspro.domain.outbound;

import java.time.LocalDate;
import java.util.*;
import com.wmspro.domain.product.UnitType;

public class OutboundOrderRequest {
    public UUID warehouseId;
    public UUID clientId;
    public OutboundOrderType orderType;
    public String channel;
    public String externalOrderNo;
    public String customer;
    public String recipient;
    public String phone;
    public String address;
    public LocalDate orderDate;
    public LocalDate requestedShipDate;
    public String memo;
    public List<ItemRequest> items;

    public static class ItemRequest {
        public UUID productId;
        public int boxCount;
        public int inputQty;
        public UnitType inputUnit = UnitType.EA;
    }
}
