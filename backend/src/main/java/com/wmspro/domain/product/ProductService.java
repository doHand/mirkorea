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
        result.getContent().forEach(p -> {
            if (p.getClient() != null) p.getClient().getName();
            if (p.getDefaultLocation() != null) p.getDefaultLocation().getCode();
            p.getBarcodes().size();
        });
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
            .clientId(req.clientId)
            .locationId(req.locationId)
            .unit(req.unit != null ? req.unit : "EA")
            .optionName(req.optionName)
            .spec(req.spec)
            .materialNo(req.materialNo)
            .boxQty(req.boxQty > 0 ? req.boxQty : 1)
            .weightG(req.weightG)
            .imageUrl(req.imageUrl)
            .safetyStock(req.safetyStock)
            .reorderPoint(req.reorderPoint)
            .costPrice(req.costPrice)
            .sellPrice(req.sellPrice)
            .priceA(req.priceA)
            .priceB(req.priceB)
            .priceC(req.priceC)
            .retailPrice(req.retailPrice)
            .memo(req.memo)
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
        if (req.code != null) {
            if (!product.getCode().equals(req.code) && productRepo.existsByCode(req.code)) {
                throw new BusinessException(ErrorCode.PRODUCT_CODE_DUPLICATE);
            }
            product.setCode(req.code);
        }
        if (req.name        != null) product.setName(req.name);
        if (req.category    != null) product.setCategory(req.category);
        if (req.clearClient)          product.setClientId(null);
        else if (req.clientId != null) product.setClientId(req.clientId);
        if (req.clearLocation)           product.setLocationId(null);
        else if (req.locationId != null) product.setLocationId(req.locationId);
        if (req.unit        != null) product.setUnit(req.unit);
        if (req.optionName  != null) product.setOptionName(req.optionName);
        if (req.spec        != null) product.setSpec(req.spec);
        if (req.materialNo  != null) product.setMaterialNo(req.materialNo);
        if (req.boxQty      > 0)    product.setBoxQty(req.boxQty);
        if (req.safetyStock >= 0)   product.setSafetyStock(req.safetyStock);
        if (req.reorderPoint >= 0)  product.setReorderPoint(req.reorderPoint);
        if (req.costPrice    != null) product.setCostPrice(req.costPrice);
        if (req.sellPrice    != null) product.setSellPrice(req.sellPrice);
        if (req.priceA       != null) product.setPriceA(req.priceA);
        if (req.priceB       != null) product.setPriceB(req.priceB);
        if (req.priceC       != null) product.setPriceC(req.priceC);
        if (req.retailPrice  != null) product.setRetailPrice(req.retailPrice);
        if (req.memo         != null) product.setMemo(req.memo);
        if (req.saleStatus   != null) product.setSaleStatus(req.saleStatus);
        if (req.imageUrl    != null) product.setImageUrl(req.imageUrl);
        if (req.isLotManaged    != null) product.setLotManaged(req.isLotManaged);
        if (req.isExpiryManaged != null) product.setExpiryManaged(req.isExpiryManaged);
        return productRepo.save(product);
    }

    @Transactional
    public void delete(UUID id) {
        Product product = findById(id);
        product.setSaleStatus(SaleStatus.DISCONTINUED);
        productRepo.save(product);
    }

    @Transactional
    public void restore(UUID id) {
        Product product = findById(id);
        product.setSaleStatus(SaleStatus.ACTIVE);
        productRepo.save(product);
    }

    public List<Barcode> findBarcodes(UUID productId) {
        return barcodeRepo.findByProductIdOrderByIsPrimaryDesc(productId);
    }

    @Transactional
    public Barcode addBarcode(UUID productId, String barcodeValue, BarcodeUnitType type, int unitQty, boolean isPrimary) {
        Product product = findById(productId);
        if (barcodeRepo.existsByBarcode(barcodeValue)) {
            throw new BusinessException(ErrorCode.BARCODE_DUPLICATE);
        }
        return barcodeRepo.save(Barcode.builder()
            .productId(productId)
            .barcode(barcodeValue)
            .type(type)
            .unitQty(normalizeBarcodeQty(type, unitQty))
            .isPrimary(isPrimary)
            .build());
    }

    @Transactional
    public Barcode updateBarcode(UUID barcodeId, String barcodeValue, BarcodeUnitType type, int unitQty, boolean isPrimary) {
        Barcode barcode = barcodeRepo.findById(barcodeId)
            .orElseThrow(() -> new BusinessException(ErrorCode.BARCODE_NOT_FOUND));
        Product product = findById(barcode.getProductId());
        if (barcodeValue != null && !barcodeValue.isBlank() && !barcodeValue.equals(barcode.getBarcode())) {
            if (barcodeRepo.existsByBarcode(barcodeValue)) {
                throw new BusinessException(ErrorCode.BARCODE_DUPLICATE);
            }
            barcode.setBarcode(barcodeValue.trim());
        }
        barcode.setType(type);
        barcode.setUnitQty(normalizeBarcodeQty(type, unitQty));
        barcode.setPrimary(isPrimary);
        return barcodeRepo.save(barcode);
    }

    @Transactional
    public void deleteBarcode(UUID barcodeId) {
        barcodeRepo.deleteById(barcodeId);
    }

    public BarcodeResolveResult resolveBarcode(String barcodeValue) {
        Barcode barcode = barcodeRepo.findActiveByBarcode(barcodeValue)
            .orElseThrow(() -> new BusinessException(ErrorCode.BARCODE_NOT_FOUND));

        Product product = barcode.getProduct();
        int qtyPerScan = qtyPerScan(barcode);

        return new BarcodeResolveResult(product, barcode.getType(), qtyPerScan);
    }

    public record BarcodeResolveResult(Product product, BarcodeUnitType unitType, int qtyPerScan) {}

    private int normalizeBarcodeQty(BarcodeUnitType type, int unitQty) {
        return isSingleUnitBarcode(type) ? 1 : Math.max(1, unitQty);
    }

    private int qtyPerScan(Barcode barcode) {
        if (isSingleUnitBarcode(barcode.getType())) {
            return 1;
        }
        if (barcode.getType() == BarcodeUnitType.CXD_BOX) {
            int inboxUnitQty = barcodeRepo.findByProductIdOrderByIsPrimaryDesc(barcode.getProductId()).stream()
                .filter(item -> item.getType() == BarcodeUnitType.CXD && item.isActive())
                .mapToInt(Barcode::getUnitQty)
                .findFirst()
                .orElse(1);
            return Math.max(1, inboxUnitQty) * Math.max(1, barcode.getUnitQty());
        }
        return Math.max(1, barcode.getUnitQty());
    }

    private boolean isSingleUnitBarcode(BarcodeUnitType type) {
        return type == BarcodeUnitType.UNIT || type == BarcodeUnitType.BOX;
    }
}
