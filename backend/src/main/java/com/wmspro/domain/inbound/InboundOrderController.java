package com.wmspro.domain.inbound;

import com.wmspro.common.ApiResponse;
import com.wmspro.common.PageResponse;
import com.wmspro.common.security.WmsPrincipal;
import com.wmspro.domain.inbound.dto.CreateInboundOrderRequest;
import com.wmspro.domain.inbound.dto.InspectItemRequest;
import com.wmspro.domain.inbound.dto.ReceiveItemRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/inbound")
@RequiredArgsConstructor
public class InboundOrderController {

    private final InboundOrderService service;

    @GetMapping
    public ApiResponse<PageResponse<InboundOrder>> list(
        @RequestParam UUID warehouseId,
        @RequestParam(required = false) InboundStatus status,
        @RequestParam(defaultValue = "1")  int page,
        @RequestParam(defaultValue = "20") int limit
    ) {
        return ApiResponse.ok(service.findAll(warehouseId, status, page, limit));
    }

    @GetMapping("/{id}")
    public ApiResponse<InboundOrder> detail(@PathVariable UUID id) {
        return ApiResponse.ok(service.findById(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','WORKER')")
    public ApiResponse<InboundOrder> create(
        @RequestBody CreateInboundOrderRequest req,
        @AuthenticationPrincipal WmsPrincipal principal
    ) {
        return ApiResponse.ok(service.create(req, principal.getUuid()), "입고 예정이 등록되었습니다");
    }

    @PatchMapping("/{id}/receive")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','WORKER')")
    public ApiResponse<InboundOrder> receive(
        @PathVariable UUID id,
        @RequestBody List<ReceiveItemRequest> items
    ) {
        return ApiResponse.ok(service.receive(id, items), "수령 정보가 저장되었습니다");
    }

    @PatchMapping("/{id}/inspect")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ApiResponse<InboundOrder> inspect(
        @PathVariable UUID id,
        @RequestBody List<InspectItemRequest> items
    ) {
        return ApiResponse.ok(service.inspect(id, items), "검수 정보가 저장되었습니다");
    }

    @PostMapping("/{id}/complete")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ApiResponse<InboundOrder> complete(
        @PathVariable UUID id,
        @AuthenticationPrincipal WmsPrincipal principal
    ) {
        return ApiResponse.ok(service.complete(id, principal.getUuid()), "입고가 완료되고 재고가 증가했습니다");
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ApiResponse<InboundOrder> cancel(@PathVariable UUID id) {
        return ApiResponse.ok(service.cancel(id), "입고 주문이 취소되었습니다");
    }
}
