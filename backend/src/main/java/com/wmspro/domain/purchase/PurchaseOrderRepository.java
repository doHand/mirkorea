package com.wmspro.domain.purchase;

import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.UUID;

public interface PurchaseOrderRepository extends JpaRepository<PurchaseOrder, UUID> {
    @Query("""
        SELECT o FROM PurchaseOrder o
        WHERE o.warehouseId = :warehouseId
          AND (:status IS NULL OR o.status = :status)
          AND (:search = '' OR LOWER(o.orderNo) LIKE LOWER(CONCAT('%', :search, '%'))
               OR LOWER(COALESCE(o.supplier, '')) LIKE LOWER(CONCAT('%', :search, '%')))
        ORDER BY o.createdAt DESC
        """)
    Page<PurchaseOrder> search(@Param("warehouseId") UUID warehouseId,
        @Param("status") PurchaseOrderStatus status, @Param("search") String search, Pageable pageable);
}
