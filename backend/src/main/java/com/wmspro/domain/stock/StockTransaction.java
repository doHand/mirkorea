package com.wmspro.domain.stock;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.wmspro.domain.product.Product;
import com.wmspro.domain.user.User;
import com.wmspro.domain.warehouse.Location;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "stock_transactions")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class StockTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    // DB 시퀀스 채번으로 고유 보장
    @Column(name = "txn_no", unique = true, nullable = false, length = 30)
    private String txnNo;

    @Column(name = "product_id", nullable = false)
    private UUID productId;

    @Column(name = "location_id", nullable = false)
    private UUID locationId;

    @Column(name = "warehouse_id", nullable = false)
    private UUID warehouseId;

    // 양수 = 증가(입고/조정증가/이동입), 음수 = 감소(출고/조정감소/이동출)
    @Column(nullable = false)
    private int qty;

    @Column(name = "qty_before", nullable = false)
    private int qtyBefore;

    @Column(name = "qty_after", nullable = false)
    private int qtyAfter;

    @Enumerated(EnumType.STRING)
    @Column(name = "tx_type", nullable = false, length = 30)
    private TxType txType;

    @Column(name = "reference_type", length = 30)
    private String referenceType;

    @Column(name = "reference_id")
    private UUID referenceId;

    @Column(name = "lot_number", length = 100)
    private String lotNumber;

    @Column(name = "expiry_date")
    private LocalDate expiryDate;

    @Column(name = "barcode_scanned", length = 100)
    private String barcodeScanned;

    @Column(columnDefinition = "TEXT")
    private String reason;

    @Column(columnDefinition = "TEXT")
    private String memo;

    @Column(name = "is_cancelled", nullable = false)
    @Builder.Default
    private boolean isCancelled = false;

    @Column(name = "cancelled_by")
    private UUID cancelledBy;

    @Column(name = "cancelled_at")
    private Instant cancelledAt;

    @Column(name = "created_by", nullable = false)
    private UUID createdBy;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", insertable = false, updatable = false)
    @JsonIgnoreProperties("barcodes")
    private Product product;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "location_id", insertable = false, updatable = false)
    @JsonIgnoreProperties({"zone", "warehouse"})
    private Location location;

    @JsonIgnoreProperties({"passwordHash", "email", "isActive", "lastLoginAt", "createdAt", "updatedAt", "warehouseId"})
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", insertable = false, updatable = false)
    private User createdByUser;
}
