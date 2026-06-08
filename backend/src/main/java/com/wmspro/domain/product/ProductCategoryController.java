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
@RequestMapping("/api/v1/product-categories")
@RequiredArgsConstructor
public class ProductCategoryController {

    private final ProductCategoryRepository categoryRepo;
    private final ProductRepository productRepo;

    @GetMapping
    public ApiResponse<List<ProductCategory>> findAll() {
        return ApiResponse.ok(categoryRepo.findAllByOrderBySortOrderAscNameAsc());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMIN') or hasRole('MANAGER')")
    @Transactional
    public ApiResponse<ProductCategory> create(@RequestBody CategoryRequest req) {
        if (categoryRepo.existsByName(req.name.trim())) {
            throw new BusinessException(ErrorCode.CATEGORY_DUPLICATE);
        }
        ProductCategory cat = ProductCategory.builder()
            .name(req.name.trim())
            .description(req.description)
            .sortOrder(req.sortOrder)
            .build();
        return ApiResponse.ok(categoryRepo.save(cat), "카테고리 등록 완료");
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasRole('MANAGER')")
    @Transactional
    public ApiResponse<ProductCategory> update(@PathVariable UUID id, @RequestBody CategoryRequest req) {
        ProductCategory cat = categoryRepo.findById(id)
            .orElseThrow(() -> new BusinessException(ErrorCode.CATEGORY_NOT_FOUND));
        if (categoryRepo.existsByNameAndIdNot(req.name.trim(), id)) {
            throw new BusinessException(ErrorCode.CATEGORY_DUPLICATE);
        }
        String oldName = cat.getName();
        cat.setName(req.name.trim());
        cat.setDescription(req.description);
        cat.setSortOrder(req.sortOrder);
        if (req.isActive != null) cat.setActive(req.isActive);
        categoryRepo.save(cat);

        // 상품의 category 문자열도 일괄 업데이트
        if (!oldName.equals(cat.getName())) {
            productRepo.updateCategoryName(oldName, cat.getName());
        }
        return ApiResponse.ok(cat);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasRole('MANAGER')")
    @Transactional
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        ProductCategory cat = categoryRepo.findById(id)
            .orElseThrow(() -> new BusinessException(ErrorCode.CATEGORY_NOT_FOUND));
        long count = productRepo.countByCategory(cat.getName());
        if (count > 0) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST);
        }
        categoryRepo.deleteById(id);
        return ApiResponse.ok(null, "카테고리 삭제 완료");
    }

    @Getter @Setter
    static class CategoryRequest {
        public String  name;
        public String  description;
        public int     sortOrder = 0;
        public Boolean isActive;
    }
}
