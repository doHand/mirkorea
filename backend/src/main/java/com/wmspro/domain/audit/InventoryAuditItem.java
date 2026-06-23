package com.wmspro.domain.audit;

import com.wmspro.domain.product.Product;
import com.wmspro.domain.warehouse.Location;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "inventory_audit_items")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class InventoryAuditItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "audit_id", nullable = false)
    private InventoryAudit audit;

    @Column(name = "product_id", nullable = false)
    private UUID productId;

    @Column(name = "location_id", nullable = false)
    private UUID locationId;

    private String lotNumber;

    @Column(nullable = false)
    private int systemQty;

    private Integer countedQty;

    private UUID txnId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", insertable = false, updatable = false)
    private Product product;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "location_id", insertable = false, updatable = false)
    private Location location;

    public int getDiffQty() {
        if (countedQty == null) return 0;
        return countedQty - systemQty;
    }
}
