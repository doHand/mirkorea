package com.wmspro.domain.product;

import com.wmspro.common.exception.BusinessException;
import com.wmspro.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class UnitConversionService {
    private final ProductRepository productRepository;

    public Conversion convert(Product product, Integer inputQty, UnitType unit) {
        if (inputQty == null || inputQty < 1 || unit == null) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST);
        }
        int factor = factor(product, unit);
        try {
            return new Conversion(unit, inputQty, factor, Math.multiplyExact(inputQty, factor));
        } catch (ArithmeticException ex) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST);
        }
    }

    public Conversion convert(java.util.UUID productId, Integer inputQty, UnitType unit) {
        Product product = productRepository.findById(productId)
            .orElseThrow(() -> new BusinessException(ErrorCode.PRODUCT_NOT_FOUND));
        return convert(product, inputQty, unit);
    }

    public int factor(Product product, UnitType unit) {
        return switch (unit) {
            case EA -> 1;
            case IN -> positive(product.getInUnitQty());
            case OUT -> positive(product.getOutUnitQty());
        };
    }

    private int positive(Integer value) {
        if (value == null || value < 1) throw new BusinessException(ErrorCode.INVALID_REQUEST);
        return value;
    }

    public record Conversion(UnitType inputUnit, int inputQty, int conversionQty, int convertedEaQty) {}
}
