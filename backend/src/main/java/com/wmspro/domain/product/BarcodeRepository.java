package com.wmspro.domain.product;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BarcodeRepository extends JpaRepository<Barcode, UUID> {

    boolean existsByBarcode(String barcode);

    boolean existsByBarcodeAndIdNot(String barcode, UUID id);

    @Query("SELECT b FROM Barcode b JOIN FETCH b.product WHERE b.barcode = :barcode AND b.isActive = true")
    Optional<Barcode> findActiveByBarcode(@Param("barcode") String barcode);

    Optional<Barcode> findByIdAndProductId(UUID id, UUID productId);

    List<Barcode> findByProductIdOrderByIsPrimaryDesc(UUID productId);

    @Query("SELECT b FROM Barcode b JOIN FETCH b.product p ORDER BY p.code ASC, b.type ASC")
    List<Barcode> findAllWithProductOrderByCode();

    @Modifying
    @Query("UPDATE Barcode b SET b.isPrimary = false WHERE b.productId = :productId AND b.id <> :barcodeId")
    int clearPrimaryForOtherBarcodes(@Param("productId") UUID productId, @Param("barcodeId") UUID barcodeId);

    @Modifying
    @Query("UPDATE Barcode b SET b.isPrimary = false WHERE b.productId = :productId")
    int clearPrimaryForProduct(@Param("productId") UUID productId);
}
