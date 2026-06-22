package com.wmspro.domain.stock.dto;

import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Getter @Setter
public class AdjustRequest {
    @NotNull public UUID   productId;
    @NotNull public UUID   locationId;
    @NotNull public UUID   warehouseId;
    @NotNull @Min(0) public int adjustedQty;  // 조정 후 목표 수량 (절대값)

    @NotBlank public String reason;
    public String memo;
    public String lotNumber;
    public String referenceType;
    public UUID   referenceId;
}
