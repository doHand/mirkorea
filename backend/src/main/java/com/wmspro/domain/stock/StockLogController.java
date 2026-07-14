package com.wmspro.domain.stock;

import com.wmspro.common.ApiResponse;
import com.wmspro.common.PageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/transactions")
@RequiredArgsConstructor
public class StockLogController {

    private final StockTransactionRepository txnRepo;

    @GetMapping
    @Transactional(readOnly = true)
    public ApiResponse<PageResponse<StockTransaction>> findAll(
        @RequestParam(required = false) UUID productId,
        @RequestParam(required = false) UUID locationId,
        @RequestParam(required = false) UUID warehouseId,
        @RequestParam(required = false) TxType txType,
        @RequestParam(required = false) UUID performedBy,
        @RequestParam(required = false) String search,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
        @RequestParam(defaultValue = "1")   int page,
        @RequestParam(defaultValue = "100") int limit
    ) {
        Specification<StockTransaction> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (productId   != null) predicates.add(cb.equal(root.get("productId"),   productId));
            if (locationId  != null) predicates.add(cb.equal(root.get("locationId"),  locationId));
            if (warehouseId != null) predicates.add(cb.equal(root.get("warehouseId"), warehouseId));
            if (txType      != null) predicates.add(cb.equal(root.get("txType"),      txType));
            if (performedBy != null) predicates.add(cb.equal(root.get("createdBy"),   performedBy));
            if (search != null && !search.isBlank()) {
                String q = "%" + search.trim().toLowerCase() + "%";
                var product = root.join("product", JoinType.LEFT);
                var location = root.join("location", JoinType.LEFT);
                predicates.add(cb.or(
                    cb.like(cb.lower(root.get("txnNo")), q),
                    cb.like(cb.lower(root.get("reason")), q),
                    cb.like(cb.lower(root.get("memo")), q),
                    cb.like(cb.lower(root.get("barcodeScanned")), q),
                    cb.like(cb.lower(root.get("referenceType")), q),
                    cb.like(cb.lower(product.get("code")), q),
                    cb.like(cb.lower(product.get("name")), q),
                    cb.like(cb.lower(product.get("materialNo")), q),
                    cb.like(cb.lower(location.get("code")), q)
                ));
            }
            if (from != null) predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"),
                from.atStartOfDay(ZoneId.of("Asia/Seoul")).toInstant()));
            if (to != null) predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"),
                to.plusDays(1).atStartOfDay(ZoneId.of("Asia/Seoul")).toInstant()));
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        var pageable = PageRequest.of(page - 1, limit, Sort.by("createdAt").descending());
        Page<StockTransaction> result = txnRepo.findAll(spec, pageable);
        return ApiResponse.ok(new PageResponse<>(result, limit));
    }
}
