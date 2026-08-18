package com.wmspro.domain.outbound;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface OutboundOrderRepository extends JpaRepository<OutboundOrder, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT o FROM OutboundOrder o WHERE o.id = :id")
    Optional<OutboundOrder> findByIdForUpdate(@Param("id") UUID id);

    @Query("""
        SELECT DISTINCT o FROM OutboundOrder o
        LEFT JOIN FETCH o.items oi
        LEFT JOIN FETCH oi.product p
        LEFT JOIN FETCH p.defaultLocation
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
