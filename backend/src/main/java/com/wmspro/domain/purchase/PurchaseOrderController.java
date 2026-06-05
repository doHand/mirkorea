package com.wmspro.domain.purchase;

import com.wmspro.common.*;
import com.wmspro.common.security.WmsPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/purchase-orders")
@RequiredArgsConstructor
public class PurchaseOrderController {
    private final PurchaseOrderService service;

    @GetMapping
    public ApiResponse<PageResponse<PurchaseOrder>> list(@RequestParam UUID warehouseId,
        @RequestParam(required = false) PurchaseOrderStatus status, @RequestParam(required = false) String search,
        @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "50") int limit) {
        return ApiResponse.ok(service.findAll(warehouseId, status, search, page, limit));
    }

    @PostMapping @ResponseStatus(HttpStatus.CREATED) @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ApiResponse<PurchaseOrder> create(@RequestBody PurchaseOrderRequest req, @AuthenticationPrincipal WmsPrincipal principal) {
        return ApiResponse.ok(service.create(req, principal.getUuid()), "발주서가 저장되었습니다");
    }

    @PutMapping("/{id}") @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ApiResponse<PurchaseOrder> update(@PathVariable UUID id, @RequestBody PurchaseOrderRequest req) {
        return ApiResponse.ok(service.update(id, req), "발주서가 수정되었습니다");
    }

    @PostMapping("/{id}/ordered") @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ApiResponse<PurchaseOrder> ordered(@PathVariable UUID id) {
        return ApiResponse.ok(service.markOrdered(id), "발주 처리되었습니다");
    }

    @PostMapping("/{id}/convert-to-inbound") @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ApiResponse<PurchaseOrder> convert(@PathVariable UUID id, @AuthenticationPrincipal WmsPrincipal principal) {
        return ApiResponse.ok(service.convertToInbound(id, principal.getUuid()), "입고 예정으로 등록되었습니다");
    }

    @PostMapping("/{id}/cancel") @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ApiResponse<PurchaseOrder> cancel(@PathVariable UUID id) {
        return ApiResponse.ok(service.cancel(id), "발주서가 취소되었습니다");
    }
}
