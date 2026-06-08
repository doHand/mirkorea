package com.wmspro.domain.product;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface ProductRepository extends JpaRepository<Product, UUID> {

    boolean existsByCode(String code);

    Optional<Product> findByCode(String code);

    @Query("SELECT p FROM Product p LEFT JOIN FETCH p.barcodes LEFT JOIN FETCH p.client LEFT JOIN FETCH p.defaultLocation WHERE p.id = :id")
    Optional<Product> findByIdWithBarcodes(@Param("id") UUID id);

    @Query(value = "SELECT DISTINCT p FROM Product p LEFT JOIN FETCH p.client c LEFT JOIN FETCH p.defaultLocation l LEFT JOIN FETCH p.barcodes WHERE " +
                 "(:search IS NULL OR p.name ILIKE %:search% OR p.code ILIKE %:search% " +
                 "OR p.category ILIKE %:search% OR p.materialNo ILIKE %:search% " +
                 "OR p.optionName ILIKE %:search% OR p.spec ILIKE %:search% " +
                 "OR c.name ILIKE %:search% OR l.code ILIKE %:search% " +
                 "OR CAST(p.saleStatus AS string) ILIKE %:search%) AND " +
                 "(:category IS NULL OR p.category = :category) AND " +
                 "(:status IS NULL OR p.saleStatus = :status)",
           countQuery = "SELECT COUNT(p) FROM Product p LEFT JOIN p.client c LEFT JOIN p.defaultLocation l WHERE " +
                 "(:search IS NULL OR p.name ILIKE %:search% OR p.code ILIKE %:search% " +
                 "OR p.category ILIKE %:search% OR p.materialNo ILIKE %:search% " +
                 "OR p.optionName ILIKE %:search% OR p.spec ILIKE %:search% " +
                 "OR c.name ILIKE %:search% OR l.code ILIKE %:search% " +
                 "OR CAST(p.saleStatus AS string) ILIKE %:search%) AND " +
                 "(:category IS NULL OR p.category = :category) AND " +
                 "(:status IS NULL OR p.saleStatus = :status)")
    Page<Product> search(
        @Param("search") String search,
        @Param("category") String category,
        @Param("status") SaleStatus status,
        Pageable pageable
    );

    long countByCategory(String category);

    @Modifying
    @Query("UPDATE Product p SET p.category = :newName WHERE p.category = :oldName")
    void updateCategoryName(@Param("oldName") String oldName, @Param("newName") String newName);
}
