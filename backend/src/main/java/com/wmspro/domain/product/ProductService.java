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
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProductService {

    private static final Pattern PACKAGE_SPEC_PATTERN = Pattern.compile(
        "^\\s*(\\d+)\\s*IN\\s*/\\s*(\\d+)\\s*OUT\\s*$",
        Pattern.CASE_INSENSITIVE
    );
    private static final Pattern IN_UNIT_PATTERN = Pattern.compile("(\\d+)\\s*IN\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern OUT_UNIT_PATTERN = Pattern.compile("(\\d+)\\s*OUT\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern LEGACY_EA_BOX_PATTERN = Pattern.compile("^\\s*(\\d+)\\s*EA\\s*/\\s*BOX\\s*$", Pattern.CASE_INSENSITIVE);

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
        PackageSpec packageSpec = parsePackageSpec(req.spec);
        Integer outUnitQty = normalizeConversion(packageSpec.outUnitQty() != null ? packageSpec.outUnitQty() : (req.outUnitQty != null ? req.outUnitQty : req.boxQty));
        Integer inUnitQty = normalizeConversion(packageSpec.inUnitQty() != null ? packageSpec.inUnitQty() : req.inUnitQty);
        if (inUnitQty == null && outUnitQty != null) {
            inUnitQty = 1;
        }
        validatePackageUnitOrder(inUnitQty, outUnitQty);
        Product product = Product.builder()
            .code(req.code)
            .name(req.name)
            .category(req.category)
            .clientId(req.clientId)
            .locationId(req.locationId)
            .unit(req.unit != null ? req.unit : "EA")
            .baseUnit(req.baseUnit != null ? req.baseUnit : UnitType.EA)
            .inUnitQty(inUnitQty)
            .outUnitQty(outUnitQty)
            .optionName(req.optionName)
            .spec(req.spec)
            .materialNo(req.materialNo)
            .outQty(req.boxQty > 0 ? req.boxQty : 1)
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
        if (req.baseUnit    != null) product.setBaseUnit(req.baseUnit);
        if (req.inUnitQty    != null) product.setInUnitQty(normalizeConversion(req.inUnitQty));
        if (req.outUnitQty  != null) product.setOutUnitQty(normalizeConversion(req.outUnitQty));
        if (req.optionName  != null) product.setOptionName(req.optionName);
        if (req.spec        != null) {
            product.setSpec(req.spec);
            PackageSpec packageSpec = parsePackageSpec(req.spec);
            if (packageSpec.inUnitQty() != null) product.setInUnitQty(packageSpec.inUnitQty());
            if (packageSpec.outUnitQty() != null) product.setOutUnitQty(packageSpec.outUnitQty());
        }
        if (product.getInUnitQty() == null && product.getOutUnitQty() != null) {
            product.setInUnitQty(1);
        }
        validatePackageUnitOrder(product.getInUnitQty(), product.getOutUnitQty());
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
        syncPackageBarcodeQuantities(product);
        return productRepo.save(product);
    }

    private void validatePackageUnitOrder(Integer inUnitQty, Integer outUnitQty) {
        if (inUnitQty != null && outUnitQty != null && inUnitQty > outUnitQty) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST);
        }
    }

    private void syncPackageBarcodeQuantities(Product product) {
        int inQty = product.getInUnitQty() != null && product.getInUnitQty() > 0 ? product.getInUnitQty() : 1;
        int outQty = product.getOutUnitQty() != null && product.getOutUnitQty() > 0 ? product.getOutUnitQty() : product.getBoxQty();

        for (Barcode barcode : barcodeRepo.findByProductIdOrderByIsPrimaryDesc(product.getId())) {
            int nextQty = switch (barcode.getType()) {
                case UNIT -> 1;
                case CXD -> inQty;
                case CXD_OUT -> Math.max(1, outQty);
            };
            if (barcode.getUnitQty() != nextQty) {
                barcode.setUnitQty(nextQty);
            }
            if (!product.getCode().equals(barcode.getProductCode())) {
                barcode.setProductCode(product.getCode());
            }
        }
    }

    private Integer normalizeConversion(Integer value) {
        return value != null && value > 0 ? value : null;
    }

    private PackageSpec parsePackageSpec(String spec) {
        if (spec == null || spec.isBlank()) return new PackageSpec(null, null);
        Matcher matcher = PACKAGE_SPEC_PATTERN.matcher(spec);
        if (matcher.matches()) {
            return new PackageSpec(
                Integer.parseInt(matcher.group(1)),
                Integer.parseInt(matcher.group(2))
            );
        }

        Integer inQty = firstMatchedNumber(IN_UNIT_PATTERN, spec);
        Integer outQty = firstMatchedNumber(OUT_UNIT_PATTERN, spec);
        if (outQty == null) {
            outQty = firstMatchedNumber(LEGACY_EA_BOX_PATTERN, spec);
        }
        if (inQty == null && outQty != null) {
            inQty = 1;
        }
        return new PackageSpec(inQty, outQty);
    }

    private Integer firstMatchedNumber(Pattern pattern, String value) {
        Matcher matcher = pattern.matcher(value);
        if (!matcher.find()) return null;
        return Integer.parseInt(matcher.group(1));
    }

    private record PackageSpec(Integer inUnitQty, Integer outUnitQty) {}

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

    public record BarcodeWithProduct(
        String id, String productId, String productCode, String productName,
        String barcode, BarcodeUnitType type, int unitQty, boolean isPrimary, boolean isActive
    ) {}

    public List<BarcodeWithProduct> findAllBarcodes() {
        return barcodeRepo.findAllWithProductOrderByCode().stream()
            .map(b -> new BarcodeWithProduct(
                b.getId().toString(),
                b.getProductId().toString(),
                b.getProductCode(),
                b.getProduct().getName(),
                b.getBarcode(),
                b.getType(),
                b.getUnitQty(),
                b.isPrimary(),
                b.isActive()
            ))
            .toList();
    }

    @Transactional
    public Barcode addBarcode(UUID productId, String barcodeValue, BarcodeUnitType type, int unitQty, boolean isPrimary) {
        Product product = findById(productId);
        String normalizedBarcode = normalizeBarcodeValue(barcodeValue);
        if (barcodeRepo.existsByBarcode(normalizedBarcode)) {
            throw new BusinessException(ErrorCode.BARCODE_DUPLICATE);
        }
        if (isPrimary) {
            barcodeRepo.clearPrimaryForProduct(productId);
        }
        Barcode saved = barcodeRepo.save(Barcode.builder()
            .productId(productId)
            .productCode(product.getCode())
            .barcode(normalizedBarcode)
            .type(type)
            .unitQty(normalizeBarcodeQty(type, unitQty))
            .isPrimary(isPrimary)
            .build());
        if (saved.isPrimary()) {
            barcodeRepo.clearPrimaryForOtherBarcodes(productId, saved.getId());
        }
        return saved;
    }

    @Transactional
    public Barcode updateBarcode(UUID productId, UUID barcodeId, String barcodeValue, BarcodeUnitType type, int unitQty, boolean isPrimary) {
        Barcode barcode = barcodeRepo.findByIdAndProductId(barcodeId, productId)
            .orElseThrow(() -> new BusinessException(ErrorCode.BARCODE_NOT_FOUND));
        String normalizedBarcode = normalizeBarcodeValue(barcodeValue);
        if (!normalizedBarcode.equals(barcode.getBarcode())) {
            if (barcodeRepo.existsByBarcodeAndIdNot(normalizedBarcode, barcodeId)) {
                throw new BusinessException(ErrorCode.BARCODE_DUPLICATE);
            }
            barcode.setBarcode(normalizedBarcode);
        }
        barcode.setType(type);
        barcode.setUnitQty(normalizeBarcodeQty(type, unitQty));
        if (isPrimary) {
            barcodeRepo.clearPrimaryForOtherBarcodes(barcode.getProductId(), barcode.getId());
        }
        barcode.setPrimary(isPrimary);
        Barcode saved = barcodeRepo.save(barcode);
        if (saved.isPrimary()) {
            barcodeRepo.clearPrimaryForOtherBarcodes(saved.getProductId(), saved.getId());
        }
        return saved;
    }

    @Transactional
    public void deleteBarcode(UUID productId, UUID barcodeId) {
        Barcode barcode = barcodeRepo.findByIdAndProductId(barcodeId, productId)
            .orElseThrow(() -> new BusinessException(ErrorCode.BARCODE_NOT_FOUND));
        barcodeRepo.delete(barcode);
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

    private String normalizeBarcodeValue(String barcodeValue) {
        if (barcodeValue == null || barcodeValue.isBlank()) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST);
        }
        return barcodeValue.trim();
    }

    private int qtyPerScan(Barcode barcode) {
        if (isSingleUnitBarcode(barcode.getType())) {
            return 1;
        }
        return Math.max(1, barcode.getUnitQty());
    }

    private boolean isSingleUnitBarcode(BarcodeUnitType type) {
        return type == BarcodeUnitType.UNIT;
    }
}
