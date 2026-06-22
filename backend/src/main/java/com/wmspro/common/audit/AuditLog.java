package com.wmspro.common.audit;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "audit_logs")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AuditLog {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(nullable = false, length = 20) private String action;
    @Column(name = "target_type", nullable = false, length = 80) private String targetType;
    @Column(name = "target_id", length = 100) private String targetId;
    @Column(nullable = false, length = 500) private String summary;
    @Column(length = 100) private String actor;
    @Column(name = "request_path", length = 300) private String requestPath;
    @CreationTimestamp @Column(name = "created_at", updatable = false) private Instant createdAt;
}
