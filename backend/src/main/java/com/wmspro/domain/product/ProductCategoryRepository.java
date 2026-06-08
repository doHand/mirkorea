package com.wmspro.domain.product;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ProductCategoryRepository extends JpaRepository<ProductCategory, UUID> {
    List<ProductCategory> findAllByOrderBySortOrderAscNameAsc();
    boolean existsByName(String name);
    boolean existsByNameAndIdNot(String name, UUID id);
}
