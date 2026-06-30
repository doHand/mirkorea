package com.wmspro.domain.outbound;

import com.wmspro.common.*;
import com.wmspro.common.security.WmsPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/outbound-orders")
@RequiredArgsConstructor
public class OutboundOrderController {
    private final OutboundOrderService service;

    @GetMapping
    public ApiResponse<PageResponse<OutboundOrder>> list(@RequestParam UUID warehouseId,
        @RequestParam(required = false) OutboundOrderStatus status, @RequestParam(required = false) String search,
        @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "50") int limit) {
        return ApiResponse.ok(service.findAll(warehouseId, status, search, page, limit));
    }

    @PostMapping @ResponseStatus(HttpStatus.CREATED) @PreAuthorize("hasAnyRole('ADMIN','MANAGER','WORKER')")
    public ApiResponse<OutboundOrder> create(@Valid @RequestBody OutboundOrderRequest req,
        @AuthenticationPrincipal WmsPrincipal principal) {
        return ApiResponse.ok(service.create(req, principal.getUuid()), "주문을 수집했습니다");
    }

    @PutMapping("/{id}") @PreAuthorize("hasAnyRole('ADMIN','MANAGER','WORKER')")
    public ApiResponse<OutboundOrder> update(@PathVariable UUID id, @Valid @RequestBody OutboundOrderRequest req) {
        return ApiResponse.ok(service.update(id, req), "주문을 수정했습니다");
    }

    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','WORKER')")
    public void delete(@PathVariable UUID id) {
        service.delete(id);
    }

    @PostMapping("/{id}/instruct") @PreAuthorize("hasAnyRole('ADMIN','MANAGER','WORKER')")
    public ApiResponse<OutboundOrder> instruct(@PathVariable UUID id) {
        return ApiResponse.ok(service.instruct(id), "출고지시를 생성했습니다");
    }

    @PostMapping("/complete-picking") @PreAuthorize("hasAnyRole('ADMIN','MANAGER','WORKER')")
    public ApiResponse<java.util.List<OutboundOrder>> completePicking(@Valid @RequestBody PickingCompletionRequest req,
        @AuthenticationPrincipal WmsPrincipal principal) {
        return ApiResponse.ok(service.completePicking(req, principal.getUuid()), "선택한 피킹을 완료했습니다");
    }

    @PostMapping("/{id}/ship") @PreAuthorize("hasAnyRole('ADMIN','MANAGER','WORKER')")
    public ApiResponse<OutboundOrder> ship(@PathVariable UUID id) {
        return ApiResponse.ok(service.ship(id), "출고를 확정했습니다");
    }

    @PostMapping("/{id}/hold") @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ApiResponse<OutboundOrder> hold(@PathVariable UUID id) {
        return ApiResponse.ok(service.hold(id), "보류 처리했습니다");
    }

    @PostMapping("/{id}/unhold") @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ApiResponse<OutboundOrder> unhold(@PathVariable UUID id) {
        return ApiResponse.ok(service.unhold(id), "보류를 해제했습니다");
    }

    @PostMapping("/{id}/cancel") @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ApiResponse<OutboundOrder> cancel(@PathVariable UUID id,
        @AuthenticationPrincipal WmsPrincipal principal) {
        return ApiResponse.ok(service.cancel(id, principal.getUuid()), "주문을 취소했습니다");
    }
}
