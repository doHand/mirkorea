package com.wmspro.domain.inbound.dto;

import java.time.LocalDate;
import java.util.UUID;

public class ReceiveItemRequest {
    public UUID itemId;
    public int receivedQty;
    public String barcodeScanned;
    public String lotNumber;
    public LocalDate expireDate;
    public UUID locationId;
}
