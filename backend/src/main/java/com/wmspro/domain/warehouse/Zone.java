package com.wmspro.domain.warehouse;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "zones", uniqueConstraints = @UniqueConstraint(columnNames = {"warehouse_id", "code"}))
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Zone {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "warehouse_id", nullable = false)
    private UUID warehouseId;

    @Column(nullable = false, length = 10)
    private String code;

    @Column(nullable = false, length = 50)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private ZoneType type = ZoneType.STORAGE;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private boolean isActive = true;
}
