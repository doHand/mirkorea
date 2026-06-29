package com.wmspro.domain.warehouse;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface LocationRepository extends JpaRepository<Location, UUID> {
    boolean existsByCode(String code);
    long countByZoneIdAndIsActiveTrue(UUID zoneId);
    List<Location> findByIsActiveTrueOrderByCode();
    List<Location> findByWarehouseIdAndIsActiveTrueOrderByCode(UUID warehouseId);
    List<Location> findByZoneIdAndIsActiveTrueOrderByCode(UUID zoneId);
}
