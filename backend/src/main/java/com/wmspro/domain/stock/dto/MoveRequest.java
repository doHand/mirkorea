package com.wmspro.domain.stock.dto;

import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Getter @Setter
public class MoveRequest {
    @NotNull public UUID   productId;
    @NotNull public UUID   fromLocationId;
    @NotNull public UUID   toLocationId;
    @NotNull public UUID   warehouseId;
    @NotNull @Min(1) public int quantity;

    public String reason;
    public String lotNumber;
}
