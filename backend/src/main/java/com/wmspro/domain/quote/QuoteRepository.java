package com.wmspro.domain.quote;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.UUID;

public interface QuoteRepository extends JpaRepository<Quote, UUID> {

    @Query("""
        SELECT q FROM Quote q
        WHERE (:docType IS NULL OR q.docType = :docType)
          AND (:search  IS NULL
               OR q.docNo      LIKE %:search%
               OR q.clientName LIKE %:search%)
        ORDER BY q.createdAt DESC
        """)
    Page<Quote> search(
        @Param("docType") String docType,
        @Param("search")  String search,
        Pageable pageable
    );

    long countByDocNoStartingWith(String prefix);
}
