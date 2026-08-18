package com.wmspro.domain.returns;

import com.wmspro.common.PageResponse;
import com.wmspro.common.exception.BusinessException;
import com.wmspro.common.exception.ErrorCode;
import com.wmspro.domain.outbound.OutboundOrder;
import com.wmspro.domain.outbound.OutboundOrderItem;
import com.wmspro.domain.outbound.OutboundOrderRepository;
import com.wmspro.domain.product.ProductRepository;
import com.wmspro.domain.returns.dto.ReturnCollectionRequest;
import com.wmspro.domain.returns.dto.ReturnCollectionBatchResponse;
import com.wmspro.domain.warehouse.Location;
import com.wmspro.domain.warehouse.LocationRepository;
import com.wmspro.domain.warehouse.WarehouseRepository;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ReturnCollectionService {

    private final ReturnCollectionRepository repository;
    private final ProductRepository productRepository;
    private final OutboundOrderRepository outboundOrderRepository;
    private final WarehouseRepository warehouseRepository;
    private final LocationRepository locationRepository;

    @Transactional
    public ReturnCollection create(ReturnCollectionRequest req, UUID userId) {
        UUID batchId = UUID.randomUUID();
        return createInternal(req, userId, batchId, createBatchNo(batchId));
    }

    @Transactional
    public ReturnCollectionBatchResponse createBatch(List<ReturnCollectionRequest> requests, UUID userId) {
        UUID batchId = UUID.randomUUID();
        String batchNo = createBatchNo(batchId);
        List<ReturnCollection> saved = requests.stream()
            .map(request -> createInternal(request, userId, batchId, batchNo))
            .toList();
        repository.flush();
        return new ReturnCollectionBatchResponse(batchId, batchNo, saved);
    }

    private ReturnCollection createInternal(
        ReturnCollectionRequest req, UUID userId, UUID batchId, String batchNo
    ) {
        if (!productRepository.existsById(req.productId)) {
            throw new BusinessException(ErrorCode.PRODUCT_NOT_FOUND);
        }
        if (!warehouseRepository.existsById(req.warehouseId)) {
            throw new BusinessException(ErrorCode.WAREHOUSE_NOT_FOUND);
        }
        if (req.locationId != null) {
            Location location = locationRepository.findById(req.locationId)
                .orElseThrow(() -> new BusinessException(ErrorCode.LOCATION_NOT_FOUND));
            if (!location.getWarehouseId().equals(req.warehouseId) || !location.isActive()) {
                throw new BusinessException(ErrorCode.INVALID_REQUEST);
            }
        }

        ReturnCollection.ReturnCollectionBuilder builder = ReturnCollection.builder()
            .type(req.type)
            .productId(req.productId)
            .warehouseId(req.warehouseId)
            .locationId(req.locationId)
            .quantity(req.quantity)
            .lotNumber(req.lotNumber)
            .reason(req.reason)
            .memo(req.memo)
            .barcodeScanned(req.barcodeScanned)
            .createdBy(userId)
            .batchId(batchId)
            .batchNo(batchNo);

        if (req.type == ReturnCollectionType.RETURN) {
            boolean hasOrder = req.outboundOrderId != null;
            boolean hasItem = req.outboundOrderItemId != null;
            if (hasOrder != hasItem) {
                throw new BusinessException(ErrorCode.INVALID_REQUEST);
            }
            // 외부 주문 연동이 있는 경우에만 원출고 건을 검증하고 연결한다.
            if (hasOrder) {
                // 동일 출고 건의 반품 수량 검증과 저장을 직렬화한다.
                OutboundOrder order = outboundOrderRepository.findByIdForUpdate(req.outboundOrderId)
                    .orElseThrow(() -> new BusinessException(ErrorCode.OUTBOUND_ORDER_NOT_FOUND));

                if (!order.getWarehouseId().equals(req.warehouseId)) {
                    throw new BusinessException(ErrorCode.INVALID_REQUEST);
                }

                OutboundOrderItem item = order.getItems().stream()
                    .filter(i -> i.getId().equals(req.outboundOrderItemId))
                    .findFirst()
                    .orElseThrow(() -> new BusinessException(ErrorCode.INVALID_REQUEST));
                if (!item.getProductId().equals(req.productId)) {
                    throw new BusinessException(ErrorCode.INVALID_REQUEST);
                }

                int alreadyReturned = repository.sumQuantityByOutboundOrderItemId(item.getId());
                if (alreadyReturned + req.quantity > item.getConvertedEaQty()) {
                    throw new BusinessException(ErrorCode.RETURN_QUANTITY_EXCEEDED, Map.of(
                        "shipped", item.getConvertedEaQty(),
                        "alreadyReturned", alreadyReturned,
                        "requested", req.quantity
                    ));
                }

                builder.outboundOrderId(order.getId())
                    .outboundOrderItemId(item.getId())
                    .clientId(order.getClientId());
            }
        }

        return repository.save(builder.build());
    }

    private String createBatchNo(UUID batchId) {
        String timestamp = LocalDateTime.now(ZoneId.of("Asia/Seoul"))
            .format(DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss"));
        return "RC-" + timestamp + "-" + batchId.toString().substring(0, 4).toUpperCase();
    }

    public PageResponse<ReturnCollection> findAll(
        ReturnCollectionType type, UUID warehouseId, UUID productId,
        String search, LocalDate from, LocalDate to, int page, int limit
    ) {
        Specification<ReturnCollection> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (warehouseId != null) predicates.add(cb.equal(root.get("warehouseId"), warehouseId));
            if (type        != null) predicates.add(cb.equal(root.get("type"), type));
            if (productId   != null) predicates.add(cb.equal(root.get("productId"), productId));
            if (search != null && !search.isBlank()) {
                String q = "%" + search.trim().toLowerCase() + "%";
                var product = root.join("product", JoinType.LEFT);
                predicates.add(cb.or(
                    cb.like(cb.lower(product.get("code")), q),
                    cb.like(cb.lower(product.get("name")), q),
                    cb.like(cb.lower(root.get("barcodeScanned")), q),
                    cb.like(cb.lower(root.get("reason")), q)
                ));
            }
            if (from != null) predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"),
                from.atStartOfDay(ZoneId.of("Asia/Seoul")).toInstant()));
            if (to != null) predicates.add(cb.lessThan(root.get("createdAt"),
                to.plusDays(1).atStartOfDay(ZoneId.of("Asia/Seoul")).toInstant()));
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<ReturnCollection> result = repository.findAll(spec,
            PageRequest.of(page - 1, limit, Sort.by("createdAt").descending()));
        return new PageResponse<>(result, limit);
    }

    public Map<UUID, Long> getSummaryByProduct(UUID warehouseId) {
        Map<UUID, Long> result = new HashMap<>();
        for (Object[] row : repository.sumQuantityGroupByProduct(warehouseId)) {
            Number n = (Number) row[1];
            result.put((UUID) row[0], n != null ? n.longValue() : 0L);
        }
        return result;
    }

    @Transactional
    public void delete(UUID id, UUID userId, String role) {
        ReturnCollection record = repository.findById(id)
            .orElseThrow(() -> new BusinessException(ErrorCode.RETURN_COLLECTION_NOT_FOUND));
        boolean manager = "ADMIN".equals(role) || "MANAGER".equals(role);
        if (!manager && !record.getCreatedBy().equals(userId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN);
        }
        repository.delete(record);
    }

    @Transactional
    public void deleteBatch(UUID batchId, UUID userId, String role) {
        List<ReturnCollection> records = repository.findAllByBatchId(batchId);
        if (records.isEmpty()) {
            throw new BusinessException(ErrorCode.RETURN_COLLECTION_NOT_FOUND);
        }
        boolean manager = "ADMIN".equals(role) || "MANAGER".equals(role);
        if (!manager && records.stream().anyMatch(record -> !record.getCreatedBy().equals(userId))) {
            throw new BusinessException(ErrorCode.FORBIDDEN);
        }
        repository.deleteAll(records);
    }

    @Transactional
    public void deleteAll(List<UUID> ids, UUID userId, String role) {
        List<ReturnCollection> records = repository.findAllById(ids);
        if (records.size() != ids.stream().distinct().count()) {
            throw new BusinessException(ErrorCode.RETURN_COLLECTION_NOT_FOUND);
        }
        boolean manager = "ADMIN".equals(role) || "MANAGER".equals(role);
        if (!manager && records.stream().anyMatch(record -> !record.getCreatedBy().equals(userId))) {
            throw new BusinessException(ErrorCode.FORBIDDEN);
        }
        repository.deleteAll(records);
    }
}
