package com.wmspro.domain.product;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter @Setter
public class ProductUpdateRequest {
    public String     name;
    public String     category;
    public String     brand;
    public String     unit;
    public int        boxQty       = -1;
    public int        safetyStock  = -1;
    public int        reorderPoint = -1;
    public BigDecimal costPrice;
    public BigDecimal sellPrice;
    public SaleStatus saleStatus;
    public String     imageUrl;
}
