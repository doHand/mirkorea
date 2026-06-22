package com.wmspro.domain.audit.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.util.UUID;

@Getter @Setter
public class CreateAuditRequest {
    @NotNull public UUID      warehouseId;
    @NotNull public LocalDate auditDate;
    public String memo;
}
