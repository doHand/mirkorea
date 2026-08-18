package com.wmspro.domain.returns.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter @Setter
public class ReturnCollectionBatchRequest {
    @NotEmpty
    public List<@Valid ReturnCollectionRequest> items;
}
