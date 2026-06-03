package com.wmspro.domain.client;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "clients")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Client {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(name = "business_no", length = 50)
    private String businessNo;

    @Column(columnDefinition = "TEXT")
    private String address;

    @Column(length = 100)
    private String industry;

    @Column(length = 100)
    private String sector;

    @Column(length = 200)
    private String email;

    @Column(length = 50)
    private String phone;

    @Column(length = 50)
    private String fax;

    @Column(name = "customer_type", length = 100)
    private String customerType;

    @Column(name = "salesperson", length = 100)
    private String salesperson;

    @Column(name = "mobile", length = 50)
    private String mobile;

    @Column(name = "ceo_name", length = 100)
    private String ceoName;

    @Column(name = "postal_code", length = 20)
    private String postalCode;

    @Column(name = "address_detail", length = 500)
    private String addressDetail;

    @Column(name = "contact_name", length = 100)
    private String contactName;

    @Column(name = "honorific", length = 50)
    private String honorific;

    @Column(name = "manager_name", length = 100)
    private String managerName;

    @Column(name = "manager_title", length = 100)
    private String managerTitle;

    @Column(length = 500)
    private String website;

    @Column(name = "employee_count")
    private Integer employeeCount;

    @Column(name = "price_policy", length = 100)
    private String pricePolicy;

    @Column(name = "tax_type", length = 100)
    private String taxType;

    @Column(name = "discount_rate", precision = 5, scale = 2)
    private BigDecimal discountRate;

    @Column(name = "initial_receivable", precision = 15, scale = 2)
    private BigDecimal initialReceivable;

    @Column(name = "unpaid_only", nullable = false)
    @Builder.Default
    private boolean unpaidOnly = false;

    @Column(name = "registration_date")
    private LocalDate registrationDate;

    @Column(name = "management_no", length = 100)
    private String managementNo;

    @Column(columnDefinition = "TEXT")
    private String memo;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private boolean isActive = true;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
