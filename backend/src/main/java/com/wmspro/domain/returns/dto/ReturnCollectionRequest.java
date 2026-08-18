package com.wmspro.domain.returns.dto;

import com.wmspro.domain.returns.ReturnCollectionType;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Getter @Setter
public class ReturnCollectionRequest {
    @NotNull public ReturnCollectionType type;
    @NotNull public UUID productId;
    @NotNull public UUID warehouseId;
    public UUID locationId;
    @NotNull @Min(1) public int quantity;
    public String lotNumber;

    // 외부 주문 연동 시에만 사용하며, 주문/품목 ID는 함께 전달해야 한다.
    public UUID outboundOrderId;
    public UUID outboundOrderItemId;
    public UUID clientId;

    public String reason;
    public String memo;
    public String barcodeScanned;
}
