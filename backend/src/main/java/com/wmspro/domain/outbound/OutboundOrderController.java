package com.wmspro.domain.outbound;

import com.wmspro.common.*;
import com.wmspro.common.security.WmsPrincipal;
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
    public ApiResponse<OutboundOrder> create(@RequestBody OutboundOrderRequest req,
        @AuthenticationPrincipal WmsPrincipal principal) {
        return ApiResponse.ok(service.create(req, principal.getUuid()), "주문을 수집했습니다");
    }

    @PutMapping("/{id}") @PreAuthorize("hasAnyRole('ADMIN','MANAGER','WORKER')")
    public ApiResponse<OutboundOrder> update(@PathVariable UUID id, @RequestBody OutboundOrderRequest req) {
        return ApiResponse.ok(service.update(id, req), "주문을 수정했습니다");
    }

    @PostMapping("/{id}/instruct") @PreAuthorize("hasAnyRole('ADMIN','MANAGER','WORKER')")
    public ApiResponse<OutboundOrder> instruct(@PathVariable UUID id) {
        return ApiResponse.ok(service.instruct(id), "출고지시를 생성했습니다");
    }

    @PostMapping("/{id}/cancel") @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ApiResponse<OutboundOrder> cancel(@PathVariable UUID id) {
        return ApiResponse.ok(service.cancel(id), "주문을 취소했습니다");
    }
}
