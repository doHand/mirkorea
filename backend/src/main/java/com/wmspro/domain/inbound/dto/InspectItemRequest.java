package com.wmspro.domain.inbound.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public class InspectItemRequest {
    @NotNull public UUID   itemId;
    @Min(0)  public int    passedQty;
    @Min(0)  public int    defectQty;
             public UUID   defectLocationId;
             public String note;
}
