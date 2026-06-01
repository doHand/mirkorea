package com.wmspro.domain.inventory;

import com.wmspro.domain.product.Product;
import com.wmspro.domain.warehouse.Location;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "inventory",
    uniqueConstraints = @UniqueConstraint(columnNames = {"product_id", "location_id", "lot_number"}))
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Inventory {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "product_id", nullable = false)
    private UUID productId;

    @Column(name = "location_id", nullable = false)
    private UUID locationId;

    @Column(name = "warehouse_id", nullable = false)
    private UUID warehouseId;

    @Column(nullable = false)
    @Builder.Default
    private int quantity = 0;

    @Column(name = "reserved_qty", nullable = false)
    @Builder.Default
    private int reservedQty = 0;

    @Column(name = "lot_number", length = 100)
    private String lotNumber;

    @Column(name = "expire_date")
    private LocalDate expireDate;

    // 낙관적 락 버전 (비관적 락과 병행 사용)
    @Version
    @Column(nullable = false)
    @Builder.Default
    private int version = 1;

    @Column(name = "last_synced_at")
    private Instant lastSyncedAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", insertable = false, updatable = false)
    private Product product;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "location_id", insertable = false, updatable = false)
    private Location location;

    public int getAvailableQty() {
        return this.quantity - this.reservedQty;
    }
}
