package com.wmspro.domain.warehouse;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "locations")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Location {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "warehouse_id", nullable = false)
    private UUID warehouseId;

    @Column(name = "zone_id", nullable = false)
    private UUID zoneId;

    @Column(unique = true, nullable = false, length = 50)
    private String code;              // A-01-03-02

    @Column(length = 10)
    private String aisle;

    @Column(length = 10)
    private String rack;

    @Column(length = 10)
    private String shelf;

    @Column(length = 10)
    private String bin;

    @Column(name = "capacity_unit")
    @Builder.Default
    private int capacityUnit = 9999;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private boolean isActive = true;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "zone_id", insertable = false, updatable = false)
    private Zone zone;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "warehouse_id", insertable = false, updatable = false)
    private Warehouse warehouse;
}
