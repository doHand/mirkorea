package com.wmspro.domain.outbound;

import com.fasterxml.jackson.annotation.*;
import com.wmspro.domain.product.Product;
import com.wmspro.domain.product.UnitType;
import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "outbound_order_items")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class OutboundOrderItem {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "outbound_order_id", nullable = false)
    @JsonBackReference private OutboundOrder order;
    @Column(name = "product_id", nullable = false) private UUID productId;
    @Column(name = "box_count", nullable = false) private int boxCount;
    @Column(name = "input_qty", nullable = false) private int inputQty;
    @Enumerated(EnumType.STRING) @Column(name = "input_unit", nullable = false, length = 10)
    @Builder.Default private UnitType inputUnit = UnitType.EA;
    @Column(name = "conversion_qty", nullable = false) @Builder.Default private int conversionQty = 1;
    @Column(name = "converted_ea_qty", nullable = false) private int convertedEaQty;
    @Column(name = "picked_box_count", nullable = false) @Builder.Default private int pickedBoxCount = 0;
    @Column(name = "unit_price", nullable = false) @Builder.Default private long unitPrice = 0;
    @Column(name = "sort_order", nullable = false) private int sortOrder;

    @ManyToOne(fetch = FetchType.EAGER) @JoinColumn(name = "product_id", insertable = false, updatable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "barcodes", "inventories"})
    private Product product;
}
