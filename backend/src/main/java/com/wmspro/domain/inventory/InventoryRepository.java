package com.wmspro.domain.inventory;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface InventoryRepository extends JpaRepository<Inventory, UUID> {

    // 비관적 락: 재고 감소(출고/취소) 시 반드시 사용
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT i FROM Inventory i WHERE i.productId = :productId AND i.locationId = :locationId AND i.lotNumber IS NULL")
    Optional<Inventory> findWithLock(@Param("productId") UUID productId,
                                     @Param("locationId") UUID locationId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT i FROM Inventory i WHERE i.productId = :productId AND i.locationId = :locationId AND i.lotNumber = :lotNumber")
    Optional<Inventory> findWithLockAndLot(@Param("productId") UUID productId,
                                            @Param("locationId") UUID locationId,
                                            @Param("lotNumber") String lotNumber);

    // 위치이동: 정렬된 순서로 다중 락 획득 (데드락 방지)
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT i FROM Inventory i WHERE i.productId = :productId AND i.locationId IN :locationIds ORDER BY i.locationId")
    List<Inventory> findWithLockMultiple(@Param("productId") UUID productId,
                                          @Param("locationIds") List<UUID> locationIds);

    // 조회용 (락 없음)
    List<Inventory> findByProductIdAndQuantityGreaterThan(UUID productId, int qty);

    @Query("SELECT i FROM Inventory i JOIN FETCH i.product p JOIN FETCH i.location l " +
           "WHERE i.warehouseId = :warehouseId AND i.quantity <= p.safetyStock AND p.safetyStock > 0")
    List<Inventory> findLowStock(@Param("warehouseId") UUID warehouseId);

    @Query("SELECT i FROM Inventory i JOIN FETCH i.product p JOIN FETCH i.location l " +
           "WHERE i.warehouseId = :warehouseId ORDER BY p.code ASC, l.code ASC")
    List<Inventory> findByWarehouseIdWithProductAndLocation(@Param("warehouseId") UUID warehouseId);

    @Query("SELECT i FROM Inventory i JOIN FETCH i.product p JOIN FETCH i.location l " +
           "WHERE i.productId = :productId AND i.warehouseId = :warehouseId AND i.quantity > 0 ORDER BY i.quantity DESC")
    List<Inventory> findAvailableByProduct(@Param("productId") UUID productId,
                                            @Param("warehouseId") UUID warehouseId);

    @Query("SELECT COUNT(DISTINCT i.productId) FROM Inventory i WHERE i.warehouseId = :wid")
    long countDistinctProducts(@Param("wid") UUID warehouseId);

    @Query("SELECT COALESCE(SUM(i.quantity), 0) FROM Inventory i WHERE i.warehouseId = :wid")
    long sumQuantity(@Param("wid") UUID warehouseId);
}
