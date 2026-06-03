package com.wmspro.domain.inbound;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.UUID;

public interface InboundOrderRepository extends JpaRepository<InboundOrder, UUID> {

    @Query("""
        SELECT o FROM InboundOrder o
        WHERE o.warehouseId = :warehouseId
          AND (:status IS NULL OR o.status = :status)
        ORDER BY o.createdAt DESC
        """)
    Page<InboundOrder> findByWarehouse(
        @Param("warehouseId") UUID warehouseId,
        @Param("status") InboundStatus status,
        Pageable pageable
    );
}
