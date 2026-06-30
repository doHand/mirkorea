package com.wmspro.domain.audit;

import com.wmspro.common.ApiResponse;
import com.wmspro.common.security.WmsPrincipal;
import com.wmspro.domain.audit.dto.CreateAuditRequest;
import com.wmspro.domain.audit.dto.UpdateCountsRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/inventory-audits")
@RequiredArgsConstructor
public class InventoryAuditController {

    private final InventoryAuditService service;

    @GetMapping
    public ApiResponse<List<InventoryAudit>> list(@RequestParam UUID warehouseId) {
        return ApiResponse.ok(service.list(warehouseId));
    }

    @GetMapping("/{id}")
    public ApiResponse<InventoryAudit> get(@PathVariable UUID id) {
        return ApiResponse.ok(service.get(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<InventoryAudit> create(
        @Valid @RequestBody CreateAuditRequest req,
        @AuthenticationPrincipal WmsPrincipal principal
    ) {
        return ApiResponse.ok(service.create(req, principal.getUuid()));
    }

    @PutMapping("/{id}/counts")
    public ApiResponse<Void> updateCounts(
        @PathVariable UUID id,
        @Valid @RequestBody UpdateCountsRequest req
    ) {
        service.updateCounts(id, req);
        return ApiResponse.ok(null);
    }

    @PostMapping("/{id}/confirm")
    public ApiResponse<InventoryAudit> confirm(
        @PathVariable UUID id,
        @AuthenticationPrincipal WmsPrincipal principal
    ) {
        return ApiResponse.ok(service.confirm(id, principal.getUuid()));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        service.delete(id);
    }
}
