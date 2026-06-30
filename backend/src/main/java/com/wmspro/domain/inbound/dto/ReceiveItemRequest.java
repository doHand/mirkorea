package com.wmspro.domain.inbound.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.UUID;

public class ReceiveItemRequest {
    @NotNull public UUID      itemId;
    @Min(1)  public int       receivedQty;
             public String    barcodeScanned;
             public String    lotNumber;
             public LocalDate expireDate;
             public UUID      locationId;
}
