package com.wmspro.domain.quote;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Getter @Setter
public class QuoteRequest {

    public String  docType;    // STATEMENT | QUOTE
    public UUID    clientId;
    public String  clientName;

    @NotNull
    public LocalDate docDate;

    public String memo;
    public List<ItemReq> items;

    @Getter @Setter
    public static class ItemReq {
        public UUID       productId;
        public String     productCode;
        public String     productName;
        public String     unit;
        public int        qty        = 1;
        public BigDecimal unitPrice  = BigDecimal.ZERO;
    }
}
