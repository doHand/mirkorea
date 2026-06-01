package com.wmspro.domain.stock.dto;

import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Getter @Setter
public class OutboundRequest {
    @NotNull public UUID   productId;
    @NotNull public UUID   locationId;
    @NotNull public UUID   warehouseId;
    @NotNull @Min(1) public int quantity;

    public String barcodeUsed;
    public String lotNumber;
    public String reason;
    public String memo;
    public UUID   slipId;
}
