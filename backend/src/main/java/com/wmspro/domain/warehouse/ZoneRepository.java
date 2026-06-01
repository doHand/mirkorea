package com.wmspro.domain.warehouse;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface ZoneRepository extends JpaRepository<Zone, UUID> {
    List<Zone> findByWarehouseIdAndIsActiveTrueOrderByCode(UUID warehouseId);
}
