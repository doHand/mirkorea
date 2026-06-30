package com.wmspro.domain.outbound;

import com.wmspro.common.PageResponse;
import com.wmspro.common.exception.*;
import com.wmspro.common.sse.SseService;
import com.wmspro.domain.inventory.Inventory;
import com.wmspro.domain.inventory.InventoryRepository;
import com.wmspro.domain.product.UnitConversionService;
import com.wmspro.domain.stock.StockService;
import com.wmspro.domain.stock.StockTransaction;
import com.wmspro.domain.stock.StockTransactionRepository;
import com.wmspro.domain.stock.dto.OutboundRequest;
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
    private final SseService sseService;
    private final UnitConversionService unitConversionService;
    private final StockService stockService;
    private final InventoryRepository inventoryRepo;
    private final StockTransactionRepository txnRepo;

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
        OutboundOrder saved = repository.save(order);
        sseService.broadcast("outbound");
        return saved;
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
        OutboundOrder saved = repository.save(order);
        sseService.broadcast("outbound");
        return saved;
    }

    @Transactional
    public OutboundOrder instruct(UUID id) {
        OutboundOrder order = findById(id);
        ensureCollected(order);
        order.setStatus(OutboundOrderStatus.INSTRUCTED);
        order.setInstructedAt(Instant.now());
        OutboundOrder saved = repository.save(order);
        sseService.broadcast("outbound");
        return saved;
    }

    @Transactional
    public List<OutboundOrder> completePicking(PickingCompletionRequest req, UUID userId) {
        if (req == null || req.orderIds == null || req.orderIds.isEmpty() || req.items == null || req.items.isEmpty()) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST);
        }
        List<OutboundOrder> orders = repository.findAllById(req.orderIds);
        if (orders.size() != new HashSet<>(req.orderIds).size()
            || orders.stream().anyMatch(order -> order.getStatus() != OutboundOrderStatus.INSTRUCTED)) {
            throw invalidStatus();
        }
        long distinctWarehouses = orders.stream().map(OutboundOrder::getWarehouseId).distinct().count();
        if (distinctWarehouses > 1) throw new BusinessException(ErrorCode.INVALID_REQUEST);

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
        List<OutboundOrder> fullyPicked = orders.stream()
            .filter(order -> order.getItems().stream()
                .allMatch(item -> item.getPickedBoxCount() >= item.getBoxCount()))
            .toList();

        fullyPicked.forEach(order -> {
            order.setStatus(OutboundOrderStatus.PICKED);
            order.setPickedAt(pickedAt);
            deductStockForOrder(order, userId);
        });

        List<OutboundOrder> result = repository.saveAll(orders);
        sseService.broadcast("outbound");
        return result;
    }

    private void deductStockForOrder(OutboundOrder order, UUID userId) {
        for (OutboundOrderItem item : order.getItems()) {
            int remaining = item.getConvertedEaQty();
            List<Inventory> available = inventoryRepo.findAvailableByProduct(item.getProductId(), order.getWarehouseId());

            for (Inventory inv : available) {
                if (remaining <= 0) break;
                int deduct = Math.min(remaining, inv.getAvailableQty());
                if (deduct <= 0) continue;

                OutboundRequest outReq = new OutboundRequest();
                outReq.productId = item.getProductId();
                outReq.locationId = inv.getLocationId();
                outReq.warehouseId = order.getWarehouseId();
                outReq.quantity = deduct;
                outReq.reason = "출고 완료 - " + order.getOrderNo();
                outReq.memo = order.getCustomer();
                outReq.referenceType = "OUTBOUND_ORDER";
                outReq.referenceId = order.getId();
                stockService.outbound(outReq, userId);
                remaining -= deduct;
            }

            if (remaining > 0) {
                throw new BusinessException(ErrorCode.INSUFFICIENT_STOCK);
            }
        }
    }

    @Transactional
    public OutboundOrder ship(UUID id) {
        OutboundOrder order = findById(id);
        if (order.getStatus() != OutboundOrderStatus.PICKED) throw invalidStatus();
        order.setStatus(OutboundOrderStatus.SHIPPED);
        order.setShippedAt(Instant.now());
        OutboundOrder saved = repository.save(order);
        sseService.broadcast("outbound");
        return saved;
    }

    @Transactional
    public OutboundOrder hold(UUID id) {
        OutboundOrder order = findById(id);
        if (order.getStatus() == OutboundOrderStatus.SHIPPED
            || order.getStatus() == OutboundOrderStatus.CANCELLED
            || order.getStatus() == OutboundOrderStatus.ON_HOLD) throw invalidStatus();
        order.setStatus(OutboundOrderStatus.ON_HOLD);
        OutboundOrder saved = repository.save(order);
        sseService.broadcast("outbound");
        return saved;
    }

    @Transactional
    public OutboundOrder unhold(UUID id) {
        OutboundOrder order = findById(id);
        if (order.getStatus() != OutboundOrderStatus.ON_HOLD) throw invalidStatus();
        order.setStatus(OutboundOrderStatus.COLLECTED);
        OutboundOrder saved = repository.save(order);
        sseService.broadcast("outbound");
        return saved;
    }

    @Transactional
    public OutboundOrder cancel(UUID id, UUID userId) {
        OutboundOrder order = findById(id);
        if (order.getStatus() == OutboundOrderStatus.CANCELLED) throw invalidStatus();

        if (order.getStatus() == OutboundOrderStatus.PICKED) {
            List<StockTransaction> txns = txnRepo.findActiveOutboundByReference(order.getId(), "OUTBOUND_ORDER");
            for (StockTransaction txn : txns) {
                stockService.cancelOutbound(txn.getId(), "출고 취소 - " + order.getOrderNo(), userId);
            }
        }

        order.setStatus(OutboundOrderStatus.CANCELLED);
        OutboundOrder saved = repository.save(order);
        sseService.broadcast("outbound");
        return saved;
    }

    @Transactional
    public void delete(UUID id) {
        OutboundOrder order = findById(id);
        ensureEditable(order);
        repository.delete(order);
        sseService.broadcast("outbound");
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
            int inputQty = item.inputQty > 0 ? item.inputQty : item.boxCount;
            if (item.productId == null || inputQty < 1) throw new BusinessException(ErrorCode.INVALID_REQUEST);
            var conversion = unitConversionService.convert(item.productId, inputQty, item.inputUnit);
            order.getItems().add(OutboundOrderItem.builder().order(order).productId(item.productId)
                .boxCount(Math.max(1, item.boxCount)).inputQty(conversion.inputQty())
                .inputUnit(conversion.inputUnit()).conversionQty(conversion.conversionQty())
                .convertedEaQty(conversion.convertedEaQty()).sortOrder(i).build());
        }
    }

    private String generateOrderNo() {
        Long seq = jdbcTemplate.queryForObject("SELECT nextval('outbound_order_seq')", Long.class);
        String date = LocalDate.now(ZoneId.of("Asia/Seoul")).format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        return String.format("SO-%s-%05d", date, seq);
    }
}
