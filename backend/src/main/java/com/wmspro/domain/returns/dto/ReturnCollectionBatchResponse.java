package com.wmspro.domain.returns.dto;

import com.wmspro.domain.returns.ReturnCollection;

import java.util.List;
import java.util.UUID;

public record ReturnCollectionBatchResponse(
    UUID batchId,
    String batchNo,
    List<ReturnCollection> items
) {}
