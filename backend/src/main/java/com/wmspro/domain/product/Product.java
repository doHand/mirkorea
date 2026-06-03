package com.wmspro.domain.product;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "products")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(unique = true, nullable = false, length = 50)
    private String code;              // 내부 상품코드

    @Column(nullable = false, length = 200)
    private String name;

    @Column(length = 100)
    private String category;

    @Column(length = 100)
    private String brand;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String unit = "EA";       // EA, BOX, KG

    @Column(name = "box_qty", nullable = false)
    @Builder.Default
    private int boxQty = 1;           // 박스당 낱개 수량

    @Column(name = "weight_g")
    private Integer weightG;

    @Column(name = "image_url", length = 500)
    private String imageUrl;

    @Column(name = "safety_stock", nullable = false)
    @Builder.Default
    private int safetyStock = 0;

    @Column(name = "reorder_point", nullable = false)
    @Builder.Default
    private int reorderPoint = 0;

    @Column(name = "cost_price", precision = 15, scale = 2)
    private BigDecimal costPrice;

    @Column(name = "sell_price", precision = 15, scale = 2)
    private BigDecimal sellPrice;

    @Enumerated(EnumType.STRING)
    @Column(name = "sale_status", nullable = false, length = 20)
    @Builder.Default
    private SaleStatus saleStatus = SaleStatus.ACTIVE;

    @Column(name = "option_name", length = 200)
    private String optionName;

    @Column(length = 200)
    private String spec;

    @Column(name = "is_lot_managed", nullable = false)
    @Builder.Default
    private boolean isLotManaged = false;

    @Column(name = "is_expiry_managed", nullable = false)
    @Builder.Default
    private boolean isExpiryManaged = false;

    @Column(name = "created_by")
    private UUID createdBy;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;

    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @Builder.Default
    @JsonIgnore
    private List<Barcode> barcodes = new ArrayList<>();

    @jakarta.persistence.Transient
    private Long stockQty;
}
