package com.wmspro.domain.product;

import com.wmspro.common.PageResponse;
import com.wmspro.common.exception.BusinessException;
import com.wmspro.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProductService {

    private final ProductRepository productRepo;
    private final BarcodeRepository barcodeRepo;

    public PageResponse<Product> findAll(String search, String category, SaleStatus status, int page, int limit) {
        var pageable = PageRequest.of(page - 1, limit, Sort.by("createdAt").descending());
        var result   = productRepo.search(search, category, status, pageable);
        return new PageResponse<>(result, limit);
    }

    public Product findById(UUID id) {
        return productRepo.findByIdWithBarcodes(id)
            .orElseThrow(() -> new BusinessException(ErrorCode.PRODUCT_NOT_FOUND));
    }

    @Transactional
    public Product create(ProductCreateRequest req, UUID userId) {
        if (productRepo.existsByCode(req.code)) {
            throw new BusinessException(ErrorCode.PRODUCT_CODE_DUPLICATE);
        }
        Product product = Product.builder()
            .code(req.code)
            .name(req.name)
            .category(req.category)
            .brand(req.brand)
            .unit(req.unit != null ? req.unit : "EA")
            .boxQty(req.boxQty > 0 ? req.boxQty : 1)
            .weightG(req.weightG)
            .imageUrl(req.imageUrl)
            .safetyStock(req.safetyStock)
            .reorderPoint(req.reorderPoint)
            .costPrice(req.costPrice)
            .sellPrice(req.sellPrice)
            .saleStatus(SaleStatus.ACTIVE)
            .isLotManaged(req.isLotManaged)
            .isExpiryManaged(req.isExpiryManaged)
            .createdBy(userId)
            .build();
        return productRepo.save(product);
    }

    @Transactional
    public Product update(UUID id, ProductUpdateRequest req) {
        Product product = findById(id);
        if (req.name        != null) product.setName(req.name);
        if (req.category    != null) product.setCategory(req.category);
        if (req.brand       != null) product.setBrand(req.brand);
        if (req.unit        != null) product.setUnit(req.unit);
        if (req.boxQty      > 0)    product.setBoxQty(req.boxQty);
        if (req.safetyStock >= 0)   product.setSafetyStock(req.safetyStock);
        if (req.reorderPoint >= 0)  product.setReorderPoint(req.reorderPoint);
        if (req.costPrice   != null) product.setCostPrice(req.costPrice);
        if (req.sellPrice   != null) product.setSellPrice(req.sellPrice);
        if (req.saleStatus  != null) product.setSaleStatus(req.saleStatus);
        if (req.imageUrl    != null) product.setImageUrl(req.imageUrl);
        return productRepo.save(product);
    }

    @Transactional
    public void delete(UUID id) {
        Product product = findById(id);
        product.setSaleStatus(SaleStatus.DISCONTINUED);
        productRepo.save(product);
    }

    public List<Barcode> findBarcodes(UUID productId) {
        return barcodeRepo.findByProductIdOrderByIsPrimaryDesc(productId);
    }

    @Transactional
    public Barcode addBarcode(UUID productId, String barcodeValue, BarcodeUnitType type, int unitQty, boolean isPrimary) {
        findById(productId);  // 존재 확인
        if (barcodeRepo.existsByBarcode(barcodeValue)) {
            throw new BusinessException(ErrorCode.BARCODE_DUPLICATE);
        }
        return barcodeRepo.save(Barcode.builder()
            .productId(productId)
            .barcode(barcodeValue)
            .type(type)
            .unitQty(unitQty > 0 ? unitQty : 1)
            .isPrimary(isPrimary)
            .build());
    }

    @Transactional
    public void deleteBarcode(UUID barcodeId) {
        barcodeRepo.deleteById(barcodeId);
    }

    // 바코드 스캔 → 상품 조회 (스캔 API에서 사용)
    public BarcodeResolveResult resolveBarcode(String barcodeValue) {
        Barcode barcode = barcodeRepo.findActiveByBarcode(barcodeValue)
            .orElseThrow(() -> new BusinessException(ErrorCode.BARCODE_NOT_FOUND));

        Product product = barcode.getProduct();
        // 박스 바코드면 낱개로 환산
        int qtyPerScan = barcode.getType() == BarcodeUnitType.BOX
            ? product.getBoxQty() * barcode.getUnitQty()
            : barcode.getUnitQty();

        return new BarcodeResolveResult(product, barcode.getType(), qtyPerScan);
    }

    public record BarcodeResolveResult(Product product, BarcodeUnitType unitType, int qtyPerScan) {}
}
