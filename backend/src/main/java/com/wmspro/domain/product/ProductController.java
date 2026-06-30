package com.wmspro.domain.product;

import com.wmspro.common.ApiResponse;
import com.wmspro.common.PageResponse;
import com.wmspro.common.security.WmsPrincipal;
import com.wmspro.domain.inventory.InventoryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/products")
@RequiredArgsConstructor
public class ProductController {

    private final ProductService   productService;
    private final InventoryService inventoryService;

    @GetMapping
    public ApiResponse<PageResponse<Product>> findAll(
        @RequestParam(required = false) String search,
        @RequestParam(required = false) String category,
        @RequestParam(required = false) SaleStatus status,
        @RequestParam(defaultValue = "1")  int page,
        @RequestParam(defaultValue = "50") int limit
    ) {
        var result   = productService.findAll(search, category, status, page, limit);
        var stockMap = inventoryService.getTotalStockByProduct();
        result.getItems().forEach(p -> p.setStockQty(stockMap.getOrDefault(p.getId(), 0L)));
        return ApiResponse.ok(result);
    }

    @GetMapping("/{id}")
    public ApiResponse<Product> findById(@PathVariable UUID id) {
        return ApiResponse.ok(productService.findById(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Product> create(
        @Valid @RequestBody ProductCreateRequest req,
        @AuthenticationPrincipal WmsPrincipal principal
    ) {
        return ApiResponse.ok(productService.create(req, principal.getUuid()), "상품 등록 완료");
    }

    @PutMapping("/{id}")
    public ApiResponse<Product> update(@PathVariable UUID id, @Valid @RequestBody ProductUpdateRequest req) {
        return ApiResponse.ok(productService.update(id, req));
    }

    @PatchMapping("/{id}")
    public ApiResponse<Product> patch(@PathVariable UUID id, @Valid @RequestBody ProductUpdateRequest req) {
        return ApiResponse.ok(productService.update(id, req));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        productService.delete(id);
        return ApiResponse.ok(null, "상품 삭제 완료");
    }

    @GetMapping("/barcodes")
    public ApiResponse<List<ProductService.BarcodeWithProduct>> findAllBarcodes() {
        return ApiResponse.ok(productService.findAllBarcodes());
    }

    @GetMapping("/{id}/barcodes")
    public ApiResponse<List<Barcode>> findBarcodes(@PathVariable UUID id) {
        return ApiResponse.ok(productService.findBarcodes(id));
    }

    @PostMapping("/{id}/barcodes")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Barcode> addBarcode(
        @PathVariable UUID id,
        @RequestBody Map<String, Object> body
    ) {
        String barcodeValue = (String) body.get("barcode");
        BarcodeUnitType type = BarcodeUnitType.from((String) body.getOrDefault("type", "UNIT"));
        int unitQty     = (int) body.getOrDefault("unitQty", 1);
        boolean primary = (boolean) body.getOrDefault("isPrimary", false);
        return ApiResponse.ok(productService.addBarcode(id, barcodeValue, type, unitQty, primary));
    }

    @PutMapping("/{productId}/barcodes/{barcodeId}")
    public ApiResponse<Barcode> updateBarcode(
        @PathVariable UUID productId,
        @PathVariable UUID barcodeId,
        @RequestBody Map<String, Object> body
    ) {
        String barcodeValue = body.get("barcode") instanceof String s ? s : null;
        BarcodeUnitType type = BarcodeUnitType.from((String) body.getOrDefault("type", "UNIT"));
        int unitQty = body.get("unitQty") instanceof Integer i ? i : 1;
        boolean isPrimary = body.get("isPrimary") instanceof Boolean b ? b : false;
        return ApiResponse.ok(productService.updateBarcode(barcodeId, barcodeValue, type, unitQty, isPrimary));
    }

    @DeleteMapping("/{productId}/barcodes/{barcodeId}")
    public ApiResponse<Void> deleteBarcode(@PathVariable UUID barcodeId) {
        productService.deleteBarcode(barcodeId);
        return ApiResponse.ok(null);
    }

    // 바코드 스캔 해석
    @GetMapping("/barcode/{barcodeValue}")
    public ApiResponse<ProductService.BarcodeResolveResult> resolveBarcode(@PathVariable String barcodeValue) {
        return ApiResponse.ok(productService.resolveBarcode(barcodeValue));
    }

    // 관리자용: 상품별 가격 + 전체 재고 현황
    @GetMapping("/pricing")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<List<Map<String, Object>>> getPricing() {
        var stockMap = inventoryService.getTotalStockByProduct();
        var items = productService.findAll(null, null, null, 1, 9999).getItems().stream()
            .map(p -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("id",          p.getId());
                m.put("code",        p.getCode());
                m.put("name",        p.getName());
                m.put("category",    p.getCategory());
                m.put("clientId",   p.getClientId());
                m.put("clientName", p.getClient() != null ? p.getClient().getName() : null);
                m.put("unit",        p.getUnit());
                m.put("boxQty",      p.getBoxQty());
                m.put("costPrice",   p.getCostPrice());
                m.put("sellPrice",   p.getSellPrice());
                m.put("safetyStock", p.getSafetyStock());
                m.put("saleStatus",  p.getSaleStatus());
                m.put("totalStock",  stockMap.getOrDefault(p.getId(), 0L));
                return m;
            })
            .toList();
        return ApiResponse.ok(items);
    }
}
