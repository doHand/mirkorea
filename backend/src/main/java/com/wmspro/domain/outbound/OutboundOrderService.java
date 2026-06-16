package com.wmspro.domain.outbound;

import com.wmspro.common.PageResponse;
import com.wmspro.common.exception.*;
import lombok.RequiredArgsConstructor;
import org.hibernate.Hibernate;
import org.springframework.data.domain.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class OutboundOrderService {
    private final OutboundOrderRepository repository;
    private final JdbcTemplate jdbcTemplate;

    public PageResponse<OutboundOrder> findAll(UUID warehouseId, OutboundOrderStatus status, String search, int page, int limit) {
        String q = search != null ? search.trim() : "";
        Page<OutboundOrder> result = repository.search(warehouseId, status, q, PageRequest.of(page - 1, limit));
        result.forEach(order -> order.getItems().forEach(item -> Hibernate.initialize(item.getProduct().getBarcodes())));
        return new PageResponse<>(result, limit);
    }

    public OutboundOrder findById(UUID id) {
        return repository.findById(id).orElseThrow(() -> new BusinessException(ErrorCode.OUTBOUND_ORDER_NOT_FOUND));
    }

    @Transactional
    public OutboundOrder create(OutboundOrderRequest req, UUID userId) {
        validate(req);
        OutboundOrder order = OutboundOrder.builder()
            .orderNo(generateOrderNo()).warehouseId(req.warehouseId)
            .clientId(req.clientId).orderType(req.orderType != null ? req.orderType : OutboundOrderType.EXTERNAL).channel(req.channel)
            .externalOrderNo(req.externalOrderNo).customer(req.customer.trim()).recipient(req.recipient)
            .phone(req.phone).address(req.address)
            .orderDate(req.orderDate != null ? req.orderDate : LocalDate.now(ZoneId.of("Asia/Seoul")))
            .requestedShipDate(req.requestedShipDate).memo(req.memo).createdBy(userId).build();
        applyItems(order, req);
        return repository.save(order);
    }

    @Transactional
    public OutboundOrder update(UUID id, OutboundOrderRequest req) {
        validate(req);
        OutboundOrder order = findById(id);
        ensureEditable(order);
        order.setClientId(req.clientId);
        order.setOrderType(req.orderType != null ? req.orderType : OutboundOrderType.EXTERNAL);
        order.setChannel(req.channel);
        order.setExternalOrderNo(req.externalOrderNo);
        order.setCustomer(req.customer.trim());
        order.setRecipient(req.recipient);
        order.setPhone(req.phone);
        order.setAddress(req.address);
        if (req.orderDate != null) order.setOrderDate(req.orderDate);
        order.setRequestedShipDate(req.requestedShipDate);
        order.setMemo(req.memo);
        order.getItems().clear();
        applyItems(order, req);
        return repository.save(order);
    }

    @Transactional
    public OutboundOrder instruct(UUID id) {
        OutboundOrder order = findById(id);
        ensureCollected(order);
        order.setStatus(OutboundOrderStatus.INSTRUCTED);
        order.setInstructedAt(Instant.now());
        return repository.save(order);
    }

    @Transactional
    public List<OutboundOrder> completePicking(PickingCompletionRequest req) {
        if (req == null || req.orderIds == null || req.orderIds.isEmpty() || req.items == null || req.items.isEmpty()) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST);
        }
        List<OutboundOrder> orders = repository.findAllById(req.orderIds);
        if (orders.size() != new HashSet<>(req.orderIds).size()
            || orders.stream().anyMatch(order -> order.getStatus() != OutboundOrderStatus.INSTRUCTED)) {
            throw invalidStatus();
        }

        Map<UUID, Integer> requestedByProduct = new HashMap<>();
        for (PickingCompletionRequest.ItemRequest item : req.items) {
            if (item.productId == null || item.boxCount < 1) throw new BusinessException(ErrorCode.INVALID_REQUEST);
            requestedByProduct.merge(item.productId, item.boxCount, Integer::sum);
        }

        List<OutboundOrderItem> orderItems = orders.stream()
            .sorted(Comparator.comparing(OutboundOrder::getInstructedAt, Comparator.nullsLast(Comparator.naturalOrder())))
            .flatMap(order -> order.getItems().stream())
            .toList();

        requestedByProduct.forEach((productId, requestedBoxes) -> {
            int remainingAvailable = orderItems.stream()
                .filter(item -> item.getProductId().equals(productId))
                .mapToInt(item -> item.getBoxCount() - item.getPickedBoxCount())
                .sum();
            if (requestedBoxes > remainingAvailable) throw new BusinessException(ErrorCode.INVALID_REQUEST);

            int remaining = requestedBoxes;
            for (OutboundOrderItem item : orderItems) {
                if (remaining == 0) break;
                if (!item.getProductId().equals(productId)) continue;
                int available = item.getBoxCount() - item.getPickedBoxCount();
                int picked = Math.min(remaining, available);
                item.setPickedBoxCount(item.getPickedBoxCount() + picked);
                remaining -= picked;
            }
        });

        Instant pickedAt = Instant.now();
        orders.stream()
            .filter(order -> order.getItems().stream()
                .allMatch(item -> item.getPickedBoxCount() >= item.getBoxCount()))
            .forEach(order -> {
                order.setStatus(OutboundOrderStatus.PICKED);
                order.setPickedAt(pickedAt);
            });
        return repository.saveAll(orders);
    }

    @Transactional
    public OutboundOrder cancel(UUID id) {
        OutboundOrder order = findById(id);
        if (order.getStatus() == OutboundOrderStatus.CANCELLED) throw invalidStatus();
        order.setStatus(OutboundOrderStatus.CANCELLED);
        return repository.save(order);
    }

    @Transactional
    public void delete(UUID id) {
        OutboundOrder order = findById(id);
        ensureEditable(order);
        repository.delete(order);
    }

    private void validate(OutboundOrderRequest req) {
        if (req.warehouseId == null || req.customer == null || req.customer.isBlank()
            || req.requestedShipDate == null
            || req.items == null || req.items.isEmpty()) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST);
        }
    }

    private void ensureCollected(OutboundOrder order) {
        if (order.getStatus() != OutboundOrderStatus.COLLECTED) throw invalidStatus();
    }

    private void ensureEditable(OutboundOrder order) {
        if (order.getStatus() != OutboundOrderStatus.COLLECTED
            && order.getStatus() != OutboundOrderStatus.INSTRUCTED) {
            throw invalidStatus();
        }
        if (order.getItems().stream().anyMatch(item -> item.getPickedBoxCount() > 0)) {
            throw invalidStatus();
        }
    }

    private BusinessException invalidStatus() {
        return new BusinessException(ErrorCode.OUTBOUND_ORDER_INVALID_STATUS);
    }

    private void applyItems(OutboundOrder order, OutboundOrderRequest req) {
        for (int i = 0; i < req.items.size(); i++) {
            OutboundOrderRequest.ItemRequest item = req.items.get(i);
            if (item.productId == null || item.boxCount < 1) throw new BusinessException(ErrorCode.INVALID_REQUEST);
            order.getItems().add(OutboundOrderItem.builder().order(order).productId(item.productId)
                .boxCount(item.boxCount).sortOrder(i).build());
        }
    }

    private String generateOrderNo() {
        Long seq = jdbcTemplate.queryForObject("SELECT nextval('outbound_order_seq')", Long.class);
        String date = LocalDate.now(ZoneId.of("Asia/Seoul")).format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        return String.format("SO-%s-%05d", date, seq);
    }
}
