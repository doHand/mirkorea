package com.wmspro.domain.inbound.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import com.wmspro.domain.product.UnitType;

public class CreateInboundOrderRequest {
    @NotNull  public UUID        warehouseId;
    @NotBlank public String      supplier;
    @NotNull  public LocalDate   expectedDate;
              public String      memo;
    @NotNull @NotEmpty public List<@Valid ItemRequest> items;

    public static class ItemRequest {
        @NotNull          public UUID      productId;
        @Min(1)           public int       expectedQty;
                          public UnitType  inputUnit = UnitType.EA;
                          public String    lotNumber;
                          public LocalDate expireDate;
                          public UUID      locationId;
    }
}
