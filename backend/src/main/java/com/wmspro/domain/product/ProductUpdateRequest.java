package com.wmspro.domain.product;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.UUID;

@Getter @Setter
public class ProductUpdateRequest {
    public String     code;
    public String     name;
    public String     category;
    public UUID       clientId;
    public boolean    clearClient   = false;   // true 이면 clientId를 null로 설정
    public UUID       locationId;
    public boolean    clearLocation = false;   // true 이면 locationId를 null로 설정
    public String     unit;
    public UnitType   baseUnit;
    public Integer    inUnitQty;
    public Integer    outUnitQty;
    public String     optionName;
    public String     spec;
    public String     materialNo;
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
    public Boolean    isExpiryManaged;
}
