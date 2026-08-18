package com.wmspro.domain.returns;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface ReturnCollectionRepository
    extends JpaRepository<ReturnCollection, UUID>, JpaSpecificationExecutor<ReturnCollection> {

    @Query("SELECT r.productId, SUM(r.quantity) FROM ReturnCollection r WHERE r.warehouseId = :warehouseId GROUP BY r.productId")
    List<Object[]> sumQuantityGroupByProduct(@Param("warehouseId") UUID warehouseId);

    @Query("SELECT COALESCE(SUM(r.quantity), 0) FROM ReturnCollection r WHERE r.outboundOrderItemId = :itemId")
    int sumQuantityByOutboundOrderItemId(@Param("itemId") UUID itemId);

    List<ReturnCollection> findAllByBatchId(UUID batchId);
}
