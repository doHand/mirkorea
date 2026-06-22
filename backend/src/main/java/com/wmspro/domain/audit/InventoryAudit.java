package com.wmspro.domain.audit;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "inventory_audits")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class InventoryAudit {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID warehouseId;

    @Column(nullable = false)
    private LocalDate auditDate;

    private String memo;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private AuditStatus status;

    private Instant confirmedAt;
    private UUID    confirmedBy;

    @Column(nullable = false)
    private UUID createdBy;

    @CreationTimestamp
    private Instant createdAt;

    @OneToMany(mappedBy = "audit", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    private List<InventoryAuditItem> items = new ArrayList<>();

    public enum AuditStatus { DRAFT, CONFIRMED }
}
