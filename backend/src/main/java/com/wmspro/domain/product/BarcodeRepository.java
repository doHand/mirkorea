package com.wmspro.domain.product;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BarcodeRepository extends JpaRepository<Barcode, UUID> {

    boolean existsByBarcode(String barcode);

    @Query("SELECT b FROM Barcode b JOIN FETCH b.product WHERE b.barcode = :barcode AND b.isActive = true")
    Optional<Barcode> findActiveByBarcode(@Param("barcode") String barcode);

    List<Barcode> findByProductIdOrderByIsPrimaryDesc(UUID productId);
}
