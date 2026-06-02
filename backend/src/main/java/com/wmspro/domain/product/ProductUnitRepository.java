package com.wmspro.domain.product;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ProductUnitRepository extends JpaRepository<ProductUnit, UUID> {
    List<ProductUnit> findAllByOrderBySortOrderAsc();
    boolean existsByCode(String code);
    boolean existsByCodeAndIdNot(String code, UUID id);
}
