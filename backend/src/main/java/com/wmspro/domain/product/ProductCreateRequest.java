package com.wmspro.domain.product;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter @Setter
public class ProductCreateRequest {
    @NotBlank public String     code;
    @NotBlank public String     name;
    public String     category;
    public String     brand;
    public String     unit;
    public int        boxQty      = 1;
    public Integer    weightG;
    public String     imageUrl;
    public int        safetyStock  = 0;
    public int        reorderPoint = 0;
    public BigDecimal costPrice;
    public BigDecimal sellPrice;
    public String     optionName;
    public String     spec;
    public boolean    isLotManaged    = false;
    public boolean    isExpiryManaged = false;
}
