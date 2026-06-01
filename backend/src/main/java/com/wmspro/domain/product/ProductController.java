package com.wmspro.domain.product;

import com.wmspro.common.ApiResponse;
import com.wmspro.common.PageResponse;
import com.wmspro.common.security.WmsPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/products")
@RequiredArgsConstructor
public class ProductController {

    private final ProductService productService;

    @GetMapping
    public ApiResponse<PageResponse<Product>> findAll(
        @RequestParam(required = false) String search,
        @RequestParam(required = false) String category,
        @RequestParam(required = false) SaleStatus status,
        @RequestParam(defaultValue = "1")  int page,
        @RequestParam(defaultValue = "50") int limit
    ) {
        return ApiResponse.ok(productService.findAll(search, category, status, page, limit));
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
    public ApiResponse<Product> update(@PathVariable UUID id, @RequestBody ProductUpdateRequest req) {
        return ApiResponse.ok(productService.update(id, req));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        productService.delete(id);
        return ApiResponse.ok(null, "상품 삭제 완료");
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
        BarcodeUnitType type = BarcodeUnitType.valueOf((String) body.getOrDefault("type", "UNIT"));
        int unitQty     = (int) body.getOrDefault("unitQty", 1);
        boolean primary = (boolean) body.getOrDefault("isPrimary", false);
        return ApiResponse.ok(productService.addBarcode(id, barcodeValue, type, unitQty, primary));
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
}
