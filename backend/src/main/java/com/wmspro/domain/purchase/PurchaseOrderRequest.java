package com.wmspro.domain.purchase;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import com.wmspro.domain.product.UnitType;

public class PurchaseOrderRequest {
    @NotNull  public UUID      warehouseId;
              public UUID      clientId;
              public String    supplier;
              public LocalDate orderDate;
              public LocalDate expectedDate;
              public String    manager;
              public String    phone;
              public String    fax;
              public String    memo;
    @NotNull @NotEmpty public List<@Valid ItemRequest> items;

    public static class ItemRequest {
        @NotNull public UUID       productId;
        @Min(1)  public int        quantity;
                 public UnitType   inputUnit = UnitType.EA;
                 public int        boxCount;
                 public String     capSize;
                 public BigDecimal unitPrice;
    }
}
