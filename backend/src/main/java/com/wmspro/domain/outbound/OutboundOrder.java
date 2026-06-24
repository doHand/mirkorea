package com.wmspro.domain.outbound;

import com.fasterxml.jackson.annotation.JsonManagedReference;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.*;
import java.util.*;

@Entity
@Table(name = "outbound_orders")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class OutboundOrder {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @Column(name = "order_no", nullable = false, unique = true, length = 30) private String orderNo;
    @Column(name = "warehouse_id", nullable = false) private UUID warehouseId;
    @Column(name = "client_id") private UUID clientId;
    @Enumerated(EnumType.STRING) @Column(name = "order_type", nullable = false, length = 20) @Builder.Default
    private OutboundOrderType orderType = OutboundOrderType.EXTERNAL;
    @Column(length = 100) private String channel;
    @Column(name = "external_order_no", length = 100) private String externalOrderNo;
    @Column(nullable = false, length = 200) private String customer;
    @Column(length = 100) private String recipient;
    @Column(length = 50) private String phone;
    @Column(length = 500) private String address;
    @Column(name = "order_date", nullable = false) private LocalDate orderDate;
    @Column(name = "requested_ship_date") private LocalDate requestedShipDate;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) @Builder.Default
    private OutboundOrderStatus status = OutboundOrderStatus.COLLECTED;
    @Column(name = "instructed_at") private Instant instructedAt;
    @Column(name = "picked_at") private Instant pickedAt;
    @Column(name = "shipped_at") private Instant shippedAt;
    @Column(name = "discount_rate", nullable = false, precision = 5, scale = 2) private BigDecimal discountRate;
    @Column(columnDefinition = "TEXT") private String memo;
    @Column(name = "created_by", nullable = false) private UUID createdBy;
    @CreationTimestamp @Column(name = "created_at", updatable = false) private Instant createdAt;
    @UpdateTimestamp @Column(name = "updated_at") private Instant updatedAt;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @JsonManagedReference @OrderBy("sortOrder ASC") @Builder.Default
    private List<OutboundOrderItem> items = new ArrayList<>();
}
