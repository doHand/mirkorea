package com.wmspro.domain.returns.dto;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;
import java.util.UUID;

public record DeleteReturnCollectionsRequest(@NotEmpty List<UUID> ids) {}
