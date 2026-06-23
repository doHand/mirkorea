package com.wmspro.domain.purchase;

import com.fasterxml.jackson.annotation.*;
import com.wmspro.domain.product.Product;
import com.wmspro.domain.product.UnitType;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "purchase_order_items")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PurchaseOrderItem {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "purchase_order_id", nullable = false)
    @JsonBackReference private PurchaseOrder order;
    @Column(name = "product_id", nullable = false) private UUID productId;
    @Column(nullable = false) private int quantity;
    @Enumerated(EnumType.STRING) @Column(name = "input_unit", nullable = false, length = 10)
    @Builder.Default private UnitType inputUnit = UnitType.EA;
    @Column(name = "conversion_qty", nullable = false) @Builder.Default private int conversionQty = 1;
    @Column(name = "converted_ea_qty", nullable = false) private int convertedEaQty;
    @Column(name = "box_count", nullable = false) private int boxCount;
    @Column(name = "cap_size", length = 100) private String capSize;
    @Column(name = "unit_price", precision = 15, scale = 2, nullable = false) @Builder.Default
    private BigDecimal unitPrice = BigDecimal.ZERO;
    @Column(name = "sort_order", nullable = false) private int sortOrder;
    @ManyToOne(fetch = FetchType.EAGER) @JoinColumn(name = "product_id", insertable = false, updatable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "barcodes", "inventories"})
    private Product product;
}
