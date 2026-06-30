package com.wmspro.domain.outbound;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.*;
import com.wmspro.domain.product.UnitType;

public class OutboundOrderRequest {
              public UUID              warehouseId;
              public UUID              clientId;
              public OutboundOrderType orderType;
              public String            channel;
              public String            externalOrderNo;
    @NotBlank public String            customer;
              public String            recipient;
              public String            phone;
              public String            address;
              public LocalDate         orderDate;
    @NotNull  public LocalDate         requestedShipDate;
              public String            memo;
    @NotNull @NotEmpty public List<@Valid ItemRequest> items;

    public static class ItemRequest {
        @NotNull public UUID     productId;
        @Min(1)  public int      boxCount;
        @Min(0)  public int      inputQty;
                 public UnitType inputUnit = UnitType.EA;
    }
}
