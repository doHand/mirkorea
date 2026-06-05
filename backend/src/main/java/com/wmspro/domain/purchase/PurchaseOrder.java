package com.wmspro.domain.purchase;

import com.fasterxml.jackson.annotation.JsonManagedReference;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.time.*;
import java.util.*;

@Entity
@Table(name = "purchase_orders")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PurchaseOrder {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @Column(name = "order_no", nullable = false, unique = true, length = 30) private String orderNo;
    @Column(name = "warehouse_id", nullable = false) private UUID warehouseId;
    @Column(length = 200) private String supplier;
    @Column(name = "order_date", nullable = false) private LocalDate orderDate;
    @Column(name = "expected_date") private LocalDate expectedDate;
    @Column(length = 100) private String manager;
    @Column(length = 50) private String phone;
    @Column(length = 50) private String fax;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) @Builder.Default
    private PurchaseOrderStatus status = PurchaseOrderStatus.DRAFT;
    @Column(columnDefinition = "TEXT") private String memo;
    @Column(name = "inbound_order_id") private UUID inboundOrderId;
    @Column(name = "created_by", nullable = false) private UUID createdBy;
    @CreationTimestamp @Column(name = "created_at", updatable = false) private Instant createdAt;
    @UpdateTimestamp @Column(name = "updated_at") private Instant updatedAt;
    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @JsonManagedReference @OrderBy("sortOrder ASC") @Builder.Default
    private List<PurchaseOrderItem> items = new ArrayList<>();
}
