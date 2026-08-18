package com.wmspro.domain.returns;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.wmspro.domain.product.Product;
import com.wmspro.domain.warehouse.Location;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "return_collections")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class ReturnCollection {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private ReturnCollectionType type;

    @Column(name = "product_id", nullable = false)
    private UUID productId;

    @Column(name = "warehouse_id", nullable = false)
    private UUID warehouseId;

    @Column(name = "location_id")
    private UUID locationId;

    @Column(nullable = false)
    private int quantity;

    @Column(name = "lot_number", length = 100)
    private String lotNumber;

    @Column(name = "outbound_order_id")
    private UUID outboundOrderId;

    @Column(name = "outbound_order_item_id")
    private UUID outboundOrderItemId;

    @Column(name = "client_id")
    private UUID clientId;

    @Column(length = 50)
    private String reason;

    @Column(columnDefinition = "TEXT")
    private String memo;

    @Column(name = "barcode_scanned", length = 100)
    private String barcodeScanned;

    @Column(name = "created_by", nullable = false)
    private UUID createdBy;

    @Column(name = "batch_id")
    private UUID batchId;

    @Column(name = "batch_no", length = 40)
    private String batchNo;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "product_id", insertable = false, updatable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "barcodes"})
    private Product product;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "location_id", insertable = false, updatable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "zone", "warehouse"})
    private Location location;
}
