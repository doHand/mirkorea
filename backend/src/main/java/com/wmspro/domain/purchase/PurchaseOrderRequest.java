package com.wmspro.domain.purchase;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

public class PurchaseOrderRequest {
    public UUID warehouseId;
    public UUID clientId;
    public String supplier;
    public LocalDate orderDate;
    public LocalDate expectedDate;
    public String manager;
    public String phone;
    public String fax;
    public String memo;
    public List<ItemRequest> items;
    public static class ItemRequest {
        public UUID productId;
        public int quantity;
        public int boxCount;
        public String capSize;
        public BigDecimal unitPrice;
    }
}
