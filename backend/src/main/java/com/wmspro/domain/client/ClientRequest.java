package com.wmspro.domain.client;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter @Setter
public class ClientRequest {
    @NotBlank
    public String name;
    public String businessNo;
    public String address;
    public String industry;
    public String sector;
    public String email;
    public String phone;
    public String fax;
    public String customerType;
    public String salesperson;
    public String mobile;
    public String ceoName;
    public String postalCode;
    public String addressDetail;
    public String contactName;
    public String honorific;
    public String managerName;
    public String managerTitle;
    public String website;
    public Integer employeeCount;
    public String pricePolicy;
    public String taxType;
    public BigDecimal discountRate;
    public BigDecimal initialReceivable;
    public Boolean unpaidOnly;
    public LocalDate registrationDate;
    public String managementNo;
    public String memo;
}
