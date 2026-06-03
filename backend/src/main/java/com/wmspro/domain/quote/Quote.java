package com.wmspro.domain.quote;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.Fetch;
import org.hibernate.annotations.FetchMode;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "quotes")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Quote {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "doc_no", nullable = false, unique = true, length = 50)
    private String docNo;

    /** STATEMENT (거래명세서) | QUOTE (견적서) */
    @Column(name = "doc_type", nullable = false, length = 20)
    @Builder.Default
    private String docType = "STATEMENT";

    @Column(name = "client_id")
    private UUID clientId;

    @Column(name = "client_name", length = 200)
    private String clientName;

    @Column(name = "doc_date", nullable = false)
    private LocalDate docDate;

    @Column(columnDefinition = "TEXT")
    private String memo;

    @Column(name = "total_amount", precision = 15, scale = 2, nullable = false)
    @Builder.Default
    private BigDecimal totalAmount = BigDecimal.ZERO;

    /** DRAFT | CONFIRMED */
    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "DRAFT";

    @Column(name = "created_by")
    private UUID createdBy;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;

    @OneToMany(mappedBy = "quote", cascade = CascadeType.ALL, fetch = FetchType.EAGER, orphanRemoval = true)
    @Fetch(FetchMode.SUBSELECT)
    @OrderBy("sortOrder ASC")
    @Builder.Default
    private List<QuoteItem> items = new ArrayList<>();
}
