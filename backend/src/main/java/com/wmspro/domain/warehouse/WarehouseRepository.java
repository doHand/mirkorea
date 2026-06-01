package com.wmspro.domain.warehouse;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface WarehouseRepository extends JpaRepository<Warehouse, UUID> {
    boolean existsByCode(String code);
    List<Warehouse> findByIsActiveTrueOrderByName();
}
