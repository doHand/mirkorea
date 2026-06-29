package com.wmspro.common.audit;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import java.util.UUID;
import java.time.Instant;

public interface AuditLogRepository extends JpaRepository<AuditLog, UUID>, JpaSpecificationExecutor<AuditLog> {
    Page<AuditLog> findByActionContainingIgnoreCaseOrTargetTypeContainingIgnoreCase(String action, String targetType, Pageable pageable);
    long deleteByCreatedAtBefore(Instant cutoff);

    @Modifying
    @Query(value = """
        DELETE FROM audit_logs
        WHERE id IN (
            SELECT id
            FROM audit_logs
            ORDER BY created_at DESC, id DESC
            OFFSET :keepCount
        )
        """, nativeQuery = true)
    int deleteOlderThanLatest(int keepCount);
}
