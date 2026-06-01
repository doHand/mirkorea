package com.wmspro.domain.stock;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface StockTransactionRepository
    extends JpaRepository<StockTransaction, UUID>, JpaSpecificationExecutor<StockTransaction> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT t FROM StockTransaction t WHERE t.id = :id")
    Optional<StockTransaction> findWithLock(@Param("id") UUID id);

    @Query("SELECT t FROM StockTransaction t JOIN FETCH t.product p JOIN FETCH t.location l " +
           "WHERE t.productId = :productId ORDER BY t.createdAt DESC")
    Page<StockTransaction> findByProduct(@Param("productId") UUID productId, Pageable pageable);

    @Query("SELECT t FROM StockTransaction t JOIN FETCH t.product p JOIN FETCH t.location l " +
           "WHERE t.locationId = :locationId ORDER BY t.createdAt DESC")
    Page<StockTransaction> findByLocation(@Param("locationId") UUID locationId, Pageable pageable);
}
