package com.wmspro.domain.inventory;

import com.wmspro.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/inventory")
@RequiredArgsConstructor
public class InventoryController {

    private final InventoryService inventoryService;

    @GetMapping("/by-product/{productId}")
    public ApiResponse<List<Inventory>> findByProduct(
        @PathVariable UUID productId,
        @RequestParam(required = false) UUID warehouseId
    ) {
        return ApiResponse.ok(inventoryService.findByProduct(productId, warehouseId));
    }

    @GetMapping("/low-stock")
    public ApiResponse<List<Inventory>> getLowStock(@RequestParam UUID warehouseId) {
        return ApiResponse.ok(inventoryService.findLowStock(warehouseId));
    }

    @GetMapping("/summary")
    public ApiResponse<Map<String, Object>> getSummary(@RequestParam UUID warehouseId) {
        return ApiResponse.ok(inventoryService.getSummary(warehouseId));
    }
}
