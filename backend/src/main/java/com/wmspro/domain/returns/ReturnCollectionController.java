package com.wmspro.domain.returns;

import com.wmspro.common.ApiResponse;
import com.wmspro.common.PageResponse;
import com.wmspro.common.security.WmsPrincipal;
import com.wmspro.domain.returns.dto.ReturnCollectionRequest;
import com.wmspro.domain.returns.dto.ReturnCollectionBatchRequest;
import com.wmspro.domain.returns.dto.ReturnCollectionBatchResponse;
import com.wmspro.domain.returns.dto.DeleteReturnCollectionsRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/return-collections")
@RequiredArgsConstructor
public class ReturnCollectionController {

    private final ReturnCollectionService service;

    @GetMapping
    public ApiResponse<PageResponse<ReturnCollection>> list(
        @RequestParam UUID warehouseId,
        @RequestParam(required = false) ReturnCollectionType type,
        @RequestParam(required = false) UUID productId,
        @RequestParam(required = false) String search,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "50") int limit
    ) {
        return ApiResponse.ok(service.findAll(type, warehouseId, productId, search, from, to, page, limit));
    }

    @GetMapping("/summary")
    public ApiResponse<Map<UUID, Long>> summary(@RequestParam UUID warehouseId) {
        return ApiResponse.ok(service.getSummaryByProduct(warehouseId));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ReturnCollection> create(
        @Valid @RequestBody ReturnCollectionRequest req,
        @AuthenticationPrincipal WmsPrincipal principal
    ) {
        return ApiResponse.ok(service.create(req, principal.getUuid()), "처리했습니다");
    }

    @PostMapping("/batch")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ReturnCollectionBatchResponse> createBatch(
        @Valid @RequestBody ReturnCollectionBatchRequest req,
        @AuthenticationPrincipal WmsPrincipal principal
    ) {
        return ApiResponse.ok(service.createBatch(req.items, principal.getUuid()), "일괄 처리했습니다");
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
        @PathVariable UUID id,
        @AuthenticationPrincipal WmsPrincipal principal
    ) {
        service.delete(id, principal.getUuid(), principal.getRole());
    }

    @DeleteMapping("/batch/{batchId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteBatch(
        @PathVariable UUID batchId,
        @AuthenticationPrincipal WmsPrincipal principal
    ) {
        service.deleteBatch(batchId, principal.getUuid(), principal.getRole());
    }

    @PostMapping("/delete")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAll(
        @Valid @RequestBody DeleteReturnCollectionsRequest req,
        @AuthenticationPrincipal WmsPrincipal principal
    ) {
        service.deleteAll(req.ids(), principal.getUuid(), principal.getRole());
    }
}
