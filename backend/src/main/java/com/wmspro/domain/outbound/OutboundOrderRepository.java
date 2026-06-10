package com.wmspro.domain.outbound;

import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.util.UUID;

public interface OutboundOrderRepository extends JpaRepository<OutboundOrder, UUID> {
    @Query("""
        SELECT o FROM OutboundOrder o
        WHERE o.warehouseId = :warehouseId
          AND (:status IS NULL OR o.status = :status)
          AND (:search = '' OR LOWER(o.orderNo) LIKE LOWER(CONCAT('%', :search, '%'))
               OR LOWER(COALESCE(o.externalOrderNo, '')) LIKE LOWER(CONCAT('%', :search, '%'))
               OR LOWER(o.customer) LIKE LOWER(CONCAT('%', :search, '%'))
               OR LOWER(COALESCE(o.recipient, '')) LIKE LOWER(CONCAT('%', :search, '%')))
        ORDER BY o.createdAt DESC
        """)
    Page<OutboundOrder> search(@Param("warehouseId") UUID warehouseId,
        @Param("status") OutboundOrderStatus status, @Param("search") String search, Pageable pageable);
}
