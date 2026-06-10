package com.wmspro.domain.outbound;

import com.wmspro.common.PageResponse;
import com.wmspro.common.exception.*;
import lombok.RequiredArgsConstructor;
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
        return new PageResponse<>(result, limit);
    }

    public OutboundOrder findById(UUID id) {
        return repository.findById(id).orElseThrow(() -> new BusinessException(ErrorCode.OUTBOUND_ORDER_NOT_FOUND));
    }

    @Transactional
    public OutboundOrder create(OutboundOrderRequest req, UUID userId) {
        validate(req);
        OutboundOrder order = OutboundOrder.builder()
            .orderNo(generateOrderNo()).warehouseId(req.warehouseId).channel(req.channel)
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
        ensureCollected(order);
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
    public OutboundOrder cancel(UUID id) {
        OutboundOrder order = findById(id);
        if (order.getStatus() == OutboundOrderStatus.CANCELLED) throw invalidStatus();
        order.setStatus(OutboundOrderStatus.CANCELLED);
        return repository.save(order);
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
