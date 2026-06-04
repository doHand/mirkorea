package com.wmspro.domain.product;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter @Setter
public class ProductUpdateRequest {
    public String     code;
    public String     name;
    public String     category;
    public String     brand;
    public String     unit;
    public String     optionName;
    public String     spec;
    public String     materialNo;
    public String     location;
    public int        boxQty        = -1;
    public int        safetyStock   = -1;
    public int        reorderPoint  = -1;
    public BigDecimal costPrice;
    public BigDecimal sellPrice;
    public BigDecimal priceA;
    public BigDecimal priceB;
    public BigDecimal priceC;
    public BigDecimal retailPrice;
    public String     memo;
    public SaleStatus saleStatus;
    public String     imageUrl;
    public Boolean    isLotManaged;
}
