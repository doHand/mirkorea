package com.wmspro.domain.product;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "barcodes")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Barcode {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "product_id", nullable = false)
    private UUID productId;

    @Column(name = "product_code", nullable = false, length = 50)
    private String productCode;

    @Column(unique = true, nullable = false, length = 100)
    private String barcode;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    @Builder.Default
    private BarcodeUnitType type = BarcodeUnitType.UNIT;

    // 스캔 1회당 처리 수량 (OUT=boxQty, 낱개=1)
    @Column(name = "unit_qty", nullable = false)
    @Builder.Default
    private int unitQty = 1;

    @Column(name = "is_primary", nullable = false)
    @Builder.Default
    private boolean isPrimary = false;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private boolean isActive = true;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", insertable = false, updatable = false)
    @JsonIgnore
    private Product product;
}
