package com.wmspro.common.audit;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;
import java.time.Instant;

public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {
    Page<AuditLog> findByActionContainingIgnoreCaseOrTargetTypeContainingIgnoreCase(String action, String targetType, Pageable pageable);
    long deleteByCreatedAtBefore(Instant cutoff);
}
