package com.wmspro.domain.stock;

import com.wmspro.common.ApiResponse;
import com.wmspro.common.security.WmsPrincipal;
import com.wmspro.domain.stock.dto.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/stock")
@RequiredArgsConstructor
public class StockController {

    private final StockService stockService;

    @PostMapping("/inbound")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<StockTransaction> inbound(
        @Valid @RequestBody InboundRequest req,
        @AuthenticationPrincipal WmsPrincipal principal
    ) {
        return ApiResponse.ok(stockService.inbound(req, principal.getId()), "입고 처리 완료");
    }

    @PostMapping("/inbound/{txnId}/cancel")
    public ApiResponse<StockTransaction> cancelInbound(
        @PathVariable UUID txnId,
        @RequestBody Map<String, String> body,
        @AuthenticationPrincipal WmsPrincipal principal
    ) {
        return ApiResponse.ok(
            stockService.cancelInbound(txnId, body.get("reason"), principal.getId()),
            "입고 취소 완료"
        );
    }

    @PostMapping("/outbound")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<StockTransaction> outbound(
        @Valid @RequestBody OutboundRequest req,
        @AuthenticationPrincipal WmsPrincipal principal
    ) {
        return ApiResponse.ok(stockService.outbound(req, principal.getId()), "출고 처리 완료");
    }

    @PostMapping("/outbound/{txnId}/cancel")
    public ApiResponse<StockTransaction> cancelOutbound(
        @PathVariable UUID txnId,
        @RequestBody Map<String, String> body,
        @AuthenticationPrincipal WmsPrincipal principal
    ) {
        return ApiResponse.ok(
            stockService.cancelOutbound(txnId, body.get("reason"), principal.getId()),
            "출고 취소 완료"
        );
    }

    @PostMapping("/adjustment")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<StockTransaction> adjust(
        @Valid @RequestBody AdjustRequest req,
        @AuthenticationPrincipal WmsPrincipal principal
    ) {
        return ApiResponse.ok(stockService.adjust(req, principal.getId()), "재고 조정 완료");
    }

    @PostMapping("/move")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Void> move(
        @Valid @RequestBody MoveRequest req,
        @AuthenticationPrincipal WmsPrincipal principal
    ) {
        stockService.move(req, principal.getId());
        return ApiResponse.ok(null, "위치 이동 완료");
    }
}
