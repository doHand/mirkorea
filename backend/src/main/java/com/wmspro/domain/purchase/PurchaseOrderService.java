package com.wmspro.domain.purchase;

import com.wmspro.common.PageResponse;
import com.wmspro.common.exception.*;
import com.wmspro.domain.inbound.*;
import com.wmspro.domain.inbound.dto.CreateInboundOrderRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PurchaseOrderService {
    private final PurchaseOrderRepository repository;
    private final InboundOrderService inboundOrderService;
    private final JdbcTemplate jdbcTemplate;

    public PageResponse<PurchaseOrder> findAll(UUID warehouseId, PurchaseOrderStatus status, String search, int page, int limit) {
        String q = search != null ? search.trim() : "";
        Page<PurchaseOrder> result = repository.search(warehouseId, status, q, PageRequest.of(page - 1, limit));
        return new PageResponse<>(result, limit);
    }

    public PurchaseOrder findById(UUID id) {
        return repository.findById(id).orElseThrow(() -> new BusinessException(ErrorCode.PURCHASE_ORDER_NOT_FOUND));
    }

    @Transactional
    public PurchaseOrder create(PurchaseOrderRequest req, UUID userId) {
        PurchaseOrder order = PurchaseOrder.builder()
            .orderNo(generateOrderNo()).warehouseId(req.warehouseId).clientId(req.clientId).supplier(req.supplier)
            .orderDate(req.orderDate != null ? req.orderDate : LocalDate.now(ZoneId.of("Asia/Seoul")))
            .expectedDate(req.expectedDate).manager(req.manager).phone(req.phone).fax(req.fax)
            .memo(req.memo).createdBy(userId).build();
        applyItems(order, req);
        return repository.save(order);
    }

    @Transactional
    public PurchaseOrder update(UUID id, PurchaseOrderRequest req) {
        PurchaseOrder order = findById(id);
        ensureEditable(order);
        order.setClientId(req.clientId);
        order.setSupplier(req.supplier);
        if (req.orderDate != null) order.setOrderDate(req.orderDate);
        order.setExpectedDate(req.expectedDate);
        order.setManager(req.manager);
        order.setPhone(req.phone);
        order.setFax(req.fax);
        order.setMemo(req.memo);
        order.getItems().clear();
        applyItems(order, req);
        return repository.save(order);
    }

    @Transactional
    public PurchaseOrder markOrdered(UUID id) {
        PurchaseOrder order = findById(id);
        if (order.getStatus() != PurchaseOrderStatus.DRAFT) throw invalidStatus();
        order.setStatus(PurchaseOrderStatus.ORDERED);
        return repository.save(order);
    }

    @Transactional
    public PurchaseOrder convertToInbound(UUID id, UUID userId) {
        PurchaseOrder order = findById(id);
        if (order.getStatus() != PurchaseOrderStatus.ORDERED) throw invalidStatus();
        CreateInboundOrderRequest req = new CreateInboundOrderRequest();
        req.warehouseId = order.getWarehouseId();
        req.supplier = order.getSupplier();
        req.expectedDate = order.getExpectedDate();
        req.memo = "발주서 " + order.getOrderNo() + " 전환" + (order.getMemo() != null ? " / " + order.getMemo() : "");
        req.items = new ArrayList<>();
        for (PurchaseOrderItem item : order.getItems()) {
            CreateInboundOrderRequest.ItemRequest converted = new CreateInboundOrderRequest.ItemRequest();
            converted.productId = item.getProductId();
            converted.expectedQty = item.getQuantity();
            req.items.add(converted);
        }
        InboundOrder inbound = inboundOrderService.create(req, userId);
        order.setStatus(PurchaseOrderStatus.CONVERTED);
        order.setInboundOrderId(inbound.getId());
        return repository.save(order);
    }

    @Transactional
    public PurchaseOrder cancel(UUID id) {
        PurchaseOrder order = findById(id);
        if (order.getStatus() == PurchaseOrderStatus.CONVERTED) throw invalidStatus();
        order.setStatus(PurchaseOrderStatus.CANCELLED);
        return repository.save(order);
    }

    private void ensureEditable(PurchaseOrder order) {
        if (order.getStatus() == PurchaseOrderStatus.CONVERTED || order.getStatus() == PurchaseOrderStatus.CANCELLED) {
            throw invalidStatus();
        }
    }

    private BusinessException invalidStatus() {
        return new BusinessException(ErrorCode.PURCHASE_ORDER_INVALID_STATUS);
    }

    private void applyItems(PurchaseOrder order, PurchaseOrderRequest req) {
        if (req.items == null) return;
        for (int i = 0; i < req.items.size(); i++) {
            PurchaseOrderRequest.ItemRequest item = req.items.get(i);
            order.getItems().add(PurchaseOrderItem.builder().order(order).productId(item.productId)
                .quantity(Math.max(1, item.quantity))
                .boxCount(Math.max(0, item.boxCount)).capSize(item.capSize)
                .unitPrice(item.unitPrice != null ? item.unitPrice : BigDecimal.ZERO).sortOrder(i).build());
        }
    }

    private String generateOrderNo() {
        Long seq = jdbcTemplate.queryForObject("SELECT nextval('purchase_order_seq')", Long.class);
        String date = LocalDate.now(ZoneId.of("Asia/Seoul")).format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        return String.format("PO-%s-%05d", date, seq);
    }
}
