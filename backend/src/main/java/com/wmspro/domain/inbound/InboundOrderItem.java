package com.wmspro.domain.inbound;

import com.fasterxml.jackson.annotation.JsonBackReference;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.wmspro.domain.product.Product;
import com.wmspro.domain.warehouse.Location;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "inbound_order_items")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class InboundOrderItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    @JsonBackReference
    private InboundOrder order;

    @Column(name = "product_id", nullable = false)
    private UUID productId;

    @Column(name = "expected_qty", nullable = false)
    private int expectedQty;

    @Column(name = "received_qty", nullable = false)
    private int receivedQty;

    @Column(name = "passed_qty", nullable = false)
    private int passedQty;

    @Column(name = "defect_qty", nullable = false)
    private int defectQty;

    @Column(name = "lot_number", length = 100)
    private String lotNumber;

    @Column(name = "expire_date")
    private LocalDate expireDate;

    @Column(name = "location_id")
    private UUID locationId;

    @Column(name = "defect_location_id")
    private UUID defectLocationId;

    @Column(name = "barcode_scanned", length = 100)
    private String barcodeScanned;

    @Column(columnDefinition = "TEXT")
    private String note;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "product_id", insertable = false, updatable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "barcodes", "inventories"})
    private Product product;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "location_id", insertable = false, updatable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "zone", "inventories"})
    private Location location;
}
