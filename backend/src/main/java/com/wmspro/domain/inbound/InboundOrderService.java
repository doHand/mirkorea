package com.wmspro.domain.inbound;

import com.wmspro.common.PageResponse;
import com.wmspro.common.exception.BusinessException;
import com.wmspro.common.exception.ErrorCode;
import com.wmspro.domain.inbound.dto.CreateInboundOrderRequest;
import com.wmspro.domain.inbound.dto.InspectItemRequest;
import com.wmspro.domain.inbound.dto.ReceiveItemRequest;
import com.wmspro.domain.stock.StockService;
import com.wmspro.domain.stock.dto.InboundRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class InboundOrderService {

    private final InboundOrderRepository     orderRepo;
    private final InboundOrderItemRepository itemRepo;
    private final StockService               stockService;
    private final JdbcTemplate               jdbcTemplate;

    // ── 목록 조회 ────────────────────────────────────────────────
    public PageResponse<InboundOrder> findAll(UUID warehouseId, InboundStatus status, int page, int limit) {
        Page<InboundOrder> p = orderRepo.findByWarehouse(
            warehouseId, status, PageRequest.of(page - 1, limit)
        );
        return new PageResponse<>(p, limit);
    }

    // ── 단건 조회 ────────────────────────────────────────────────
    public InboundOrder findById(UUID id) {
        return orderRepo.findById(id)
            .orElseThrow(() -> new BusinessException(ErrorCode.INBOUND_ORDER_NOT_FOUND));
    }

    // ── 입고 예정 등록 ───────────────────────────────────────────
    @Transactional
    public InboundOrder create(CreateInboundOrderRequest req, UUID userId) {
        InboundOrder order = InboundOrder.builder()
            .orderNo(generateOrderNo())
            .warehouseId(req.warehouseId)
            .supplier(req.supplier)
            .expectedDate(req.expectedDate)
            .memo(req.memo)
            .status(InboundStatus.PENDING)
            .createdBy(userId)
            .build();

        if (req.items != null) {
            for (CreateInboundOrderRequest.ItemRequest ir : req.items) {
                InboundOrderItem item = InboundOrderItem.builder()
                    .order(order)
                    .productId(ir.productId)
                    .expectedQty(ir.expectedQty)
                    .lotNumber(ir.lotNumber)
                    .expireDate(ir.expireDate)
                    .locationId(ir.locationId)
                    .build();
                order.getItems().add(item);
            }
        }
        return orderRepo.save(order);
    }

    // ── 바코드 스캔 수령 ─────────────────────────────────────────
    @Transactional
    public InboundOrder receive(UUID orderId, List<ReceiveItemRequest> requests) {
        InboundOrder order = findById(orderId);
        if (order.getStatus() == InboundStatus.COMPLETED || order.getStatus() == InboundStatus.CANCELLED) {
            throw new BusinessException(ErrorCode.INBOUND_INVALID_STATUS);
        }

        for (ReceiveItemRequest req : requests) {
            InboundOrderItem item = itemRepo.findById(req.itemId)
                .orElseThrow(() -> new BusinessException(ErrorCode.INBOUND_ITEM_NOT_FOUND));
            item.setReceivedQty(req.receivedQty);
            if (req.barcodeScanned != null) item.setBarcodeScanned(req.barcodeScanned);
            if (req.lotNumber      != null) item.setLotNumber(req.lotNumber);
            if (req.expireDate     != null) item.setExpireDate(req.expireDate);
            if (req.locationId     != null) item.setLocationId(req.locationId);
            itemRepo.save(item);
        }

        if (order.getStatus() == InboundStatus.PENDING) {
            order.setStatus(InboundStatus.RECEIVING);
        }
        return orderRepo.save(order);
    }

    // ── 입고 검수 ─────────────────────────────────────────────────
    @Transactional
    public InboundOrder inspect(UUID orderId, List<InspectItemRequest> requests) {
        InboundOrder order = findById(orderId);
        if (order.getStatus() != InboundStatus.RECEIVING && order.getStatus() != InboundStatus.INSPECTING) {
            throw new BusinessException(ErrorCode.INBOUND_INVALID_STATUS);
        }

        for (InspectItemRequest req : requests) {
            InboundOrderItem item = itemRepo.findById(req.itemId)
                .orElseThrow(() -> new BusinessException(ErrorCode.INBOUND_ITEM_NOT_FOUND));
            if (req.passedQty + req.defectQty > item.getReceivedQty()) {
                throw new BusinessException(ErrorCode.INBOUND_QTY_EXCEEDED);
            }
            item.setPassedQty(req.passedQty);
            item.setDefectQty(req.defectQty);
            if (req.defectLocationId != null) item.setDefectLocationId(req.defectLocationId);
            if (req.note != null) item.setNote(req.note);
            itemRepo.save(item);
        }

        order.setStatus(InboundStatus.INSPECTING);
        return orderRepo.save(order);
    }

    // ── 완료: 자동 재고 증가 + 불량 처리 ──────────────────────────
    @Transactional
    public InboundOrder complete(UUID orderId, UUID userId) {
        InboundOrder order = findById(orderId);
        if (order.getStatus() != InboundStatus.INSPECTING && order.getStatus() != InboundStatus.RECEIVING) {
            throw new BusinessException(ErrorCode.INBOUND_INVALID_STATUS);
        }

        for (InboundOrderItem item : order.getItems()) {
            int passedQty = item.getPassedQty() > 0 ? item.getPassedQty() : item.getReceivedQty();

            // 합격 수량 → 정상 입고
            if (passedQty > 0 && item.getLocationId() != null) {
                InboundRequest req = new InboundRequest();
                req.productId   = item.getProductId();
                req.locationId  = item.getLocationId();
                req.warehouseId = order.getWarehouseId();
                req.quantity    = passedQty;
                req.lotNumber   = item.getLotNumber();
                req.expireDate  = item.getExpireDate();
                req.reason      = "입고 완료 - " + order.getOrderNo();
                req.memo        = order.getSupplier();
                stockService.inbound(req, userId);
            }

            // 불량 수량 → 불량 위치 입고
            if (item.getDefectQty() > 0 && item.getDefectLocationId() != null) {
                InboundRequest defReq = new InboundRequest();
                defReq.productId   = item.getProductId();
                defReq.locationId  = item.getDefectLocationId();
                defReq.warehouseId = order.getWarehouseId();
                defReq.quantity    = item.getDefectQty();
                defReq.lotNumber   = item.getLotNumber();
                defReq.reason      = "불량 처리 - " + order.getOrderNo();
                stockService.inbound(defReq, userId);
            }
        }

        order.setStatus(InboundStatus.COMPLETED);
        return orderRepo.save(order);
    }

    // ── 취소 ──────────────────────────────────────────────────────
    @Transactional
    public InboundOrder cancel(UUID orderId) {
        InboundOrder order = findById(orderId);
        if (order.getStatus() == InboundStatus.COMPLETED) {
            throw new BusinessException(ErrorCode.INBOUND_INVALID_STATUS);
        }
        order.setStatus(InboundStatus.CANCELLED);
        return orderRepo.save(order);
    }

    // ── 삭제 ─────────────────────────────────────────────────────
    @Transactional
    public void delete(UUID id) {
        InboundOrder order = findById(id);
        orderRepo.delete(order);
    }

    // ── Private ───────────────────────────────────────────────────
    private String generateOrderNo() {
        Long seq  = jdbcTemplate.queryForObject("SELECT nextval('inbound_seq')", Long.class);
        String dt = LocalDate.now(ZoneId.of("Asia/Seoul")).format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        return String.format("IB-%s-%05d", dt, seq);
    }
}
