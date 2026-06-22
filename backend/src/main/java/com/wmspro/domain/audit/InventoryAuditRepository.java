package com.wmspro.domain.audit;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface InventoryAuditRepository extends JpaRepository<InventoryAudit, UUID> {

    @Query("SELECT a FROM InventoryAudit a WHERE a.warehouseId = :warehouseId ORDER BY a.auditDate DESC, a.createdAt DESC")
    List<InventoryAudit> findByWarehouseId(UUID warehouseId);

    @Query("SELECT a FROM InventoryAudit a LEFT JOIN FETCH a.items i LEFT JOIN FETCH i.product LEFT JOIN FETCH i.location WHERE a.id = :id")
    Optional<InventoryAudit> findWithItems(UUID id);
}
