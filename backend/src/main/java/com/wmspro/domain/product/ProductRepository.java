package com.wmspro.domain.product;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface ProductRepository extends JpaRepository<Product, UUID> {

    boolean existsByCode(String code);

    Optional<Product> findByCode(String code);

    @Query("SELECT p FROM Product p LEFT JOIN FETCH p.barcodes WHERE p.id = :id")
    Optional<Product> findByIdWithBarcodes(@Param("id") UUID id);

    @Query("SELECT p FROM Product p WHERE " +
           "(:search IS NULL OR p.name ILIKE %:search% OR p.code ILIKE %:search%) AND " +
           "(:category IS NULL OR p.category = :category) AND " +
           "(:status IS NULL OR p.saleStatus = :status)")
    Page<Product> search(
        @Param("search") String search,
        @Param("category") String category,
        @Param("status") SaleStatus status,
        Pageable pageable
    );
}
