package com.wmspro.domain.inbound.dto;

import java.util.UUID;

public class InspectItemRequest {
    public UUID itemId;
    public int passedQty;
    public int defectQty;
    public UUID defectLocationId;
    public String note;
}
