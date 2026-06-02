package com.wmspro.domain.product;

import com.wmspro.common.ApiResponse;
import com.wmspro.common.exception.BusinessException;
import com.wmspro.common.exception.ErrorCode;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.Setter;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/product-units")
@RequiredArgsConstructor
public class ProductUnitController {

    private final ProductUnitRepository unitRepo;

    @GetMapping
    public ApiResponse<List<ProductUnit>> findAll() {
        return ApiResponse.ok(unitRepo.findAllByOrderBySortOrderAsc());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMIN') or hasRole('MANAGER')")
    @Transactional
    public ApiResponse<ProductUnit> create(@RequestBody UnitRequest req) {
        if (unitRepo.existsByCode(req.code)) {
            throw new BusinessException(ErrorCode.PRODUCT_CODE_DUPLICATE);
        }
        ProductUnit unit = ProductUnit.builder()
            .code(req.code.toUpperCase())
            .label(req.label)
            .description(req.description)
            .sortOrder(req.sortOrder)
            .build();
        return ApiResponse.ok(unitRepo.save(unit), "단위 등록 완료");
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasRole('MANAGER')")
    @Transactional
    public ApiResponse<ProductUnit> update(@PathVariable UUID id, @RequestBody UnitRequest req) {
        ProductUnit unit = unitRepo.findById(id)
            .orElseThrow(() -> new BusinessException(ErrorCode.PRODUCT_NOT_FOUND));
        if (unitRepo.existsByCodeAndIdNot(req.code, id)) {
            throw new BusinessException(ErrorCode.PRODUCT_CODE_DUPLICATE);
        }
        unit.setCode(req.code.toUpperCase());
        unit.setLabel(req.label);
        unit.setDescription(req.description);
        unit.setSortOrder(req.sortOrder);
        if (req.isActive != null) unit.setActive(req.isActive);
        return ApiResponse.ok(unitRepo.save(unit));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        unitRepo.deleteById(id);
        return ApiResponse.ok(null, "단위 삭제 완료");
    }

    @Getter @Setter
    static class UnitRequest {
        public String  code;
        public String  label;
        public String  description;
        public int     sortOrder = 0;
        public Boolean isActive;
    }
}
