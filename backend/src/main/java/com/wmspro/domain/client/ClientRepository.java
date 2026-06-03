package com.wmspro.domain.client;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.UUID;

public interface ClientRepository extends JpaRepository<Client, UUID> {

    @Query("""
        SELECT c FROM Client c
        WHERE :search IS NULL
           OR c.name LIKE %:search%
           OR c.businessNo LIKE %:search%
           OR c.managerName LIKE %:search%
           OR c.phone LIKE %:search%
        """)
    Page<Client> search(@Param("search") String search, Pageable pageable);
}
