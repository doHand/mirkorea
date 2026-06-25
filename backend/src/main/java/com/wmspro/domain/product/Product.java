package com.wmspro.domain.product;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.wmspro.domain.client.Client;
import com.wmspro.domain.warehouse.Location;
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

    @Column(name = "client_id")
    private UUID clientId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "client_id", insertable = false, updatable = false)
    @JsonIgnoreProperties({"businessNo","address","industry","sector","fax","customerType","salesperson",
        "mobile","ceoName","postalCode","addressDetail","contactName","honorific","managerName",
        "managerTitle","website","employeeCount","pricePolicy","taxType","discountRate",
        "initialReceivable","unpaidOnly","registrationDate","managementNo","memo","isActive",
        "createdAt","updatedAt"})
    private Client client;

    @jakarta.persistence.Transient
    @Builder.Default
    private String unit = "EA";       // EA, IN,OUT

    @Enumerated(EnumType.STRING)
    @Column(name = "base_unit", nullable = false, length = 10)
    @Builder.Default
    private UnitType baseUnit = UnitType.EA;

    @Column(name = "in_unit_qty")
    private Integer inUnitQty;

    @Column(name = "out_unit_qty")
    private Integer outUnitQty;

    @Column(name = "out_qty", nullable = false)
    @Builder.Default
    private int outQty = 1;

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

    @Column(name = "material_no", length = 50)
    private String materialNo;

    @Column(name = "location_id")
    private UUID locationId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "location_id", insertable = false, updatable = false)
    private Location defaultLocation;

    @Column(name = "price_a", precision = 15, scale = 2)
    private BigDecimal priceA;

    @Column(name = "price_b", precision = 15, scale = 2)
    private BigDecimal priceB;

    @Column(name = "price_c", precision = 15, scale = 2)
    private BigDecimal priceC;

    @Column(name = "retail_price", precision = 15, scale = 2)
    private BigDecimal retailPrice;

    @Column(name = "memo", length = 500)
    private String memo;

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
    private List<Barcode> barcodes = new ArrayList<>();

    @jakarta.persistence.Transient
    private Long stockQty;

    public int getBoxQty() {
        return outQty > 0 ? outQty : 1;
    }

    public void setBoxQty(int boxQty) {
        if (boxQty > 0) {
            this.outQty = boxQty;
        }
    }
}
