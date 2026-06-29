package com.wmspro.domain.stock;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.lang.NonNull;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface StockTransactionRepository
    extends JpaRepository<StockTransaction, UUID>, JpaSpecificationExecutor<StockTransaction> {

    @Override
    @NonNull
    @EntityGraph(attributePaths = {"product", "location", "createdByUser"})
    Page<StockTransaction> findAll(@NonNull Specification<StockTransaction> spec, @NonNull Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT t FROM StockTransaction t WHERE t.id = :id")
    Optional<StockTransaction> findWithLock(@Param("id") UUID id);

    @Query("SELECT t FROM StockTransaction t JOIN FETCH t.product p JOIN FETCH t.location l LEFT JOIN FETCH t.createdByUser " +
           "WHERE t.productId = :productId ORDER BY t.createdAt DESC")
    Page<StockTransaction> findByProduct(@Param("productId") UUID productId, Pageable pageable);

    @Query("SELECT t FROM StockTransaction t JOIN FETCH t.product p JOIN FETCH t.location l LEFT JOIN FETCH t.createdByUser " +
           "WHERE t.locationId = :locationId ORDER BY t.createdAt DESC")
    Page<StockTransaction> findByLocation(@Param("locationId") UUID locationId, Pageable pageable);

    @Query("SELECT t FROM StockTransaction t WHERE t.referenceId = :referenceId AND t.referenceType = :referenceType AND t.isCancelled = false AND t.txType = com.wmspro.domain.stock.TxType.OUTBOUND")
    java.util.List<StockTransaction> findActiveOutboundByReference(@Param("referenceId") UUID referenceId,
                                                                    @Param("referenceType") String referenceType);

    @Modifying
    @Query(value = """
        DELETE FROM stock_transactions
        WHERE warehouse_id = :warehouseId
          AND id IN (
            SELECT id
            FROM stock_transactions
            WHERE warehouse_id = :warehouseId
            ORDER BY created_at DESC, id DESC
            OFFSET :keepCount
          )
        """, nativeQuery = true)
    int deleteOlderThanLatest(@Param("warehouseId") UUID warehouseId, @Param("keepCount") int keepCount);
}
