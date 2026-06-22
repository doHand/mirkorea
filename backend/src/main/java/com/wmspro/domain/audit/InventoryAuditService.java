package com.wmspro.domain.audit;

import com.wmspro.common.exception.BusinessException;
import com.wmspro.common.exception.ErrorCode;
import com.wmspro.domain.audit.dto.CreateAuditRequest;
import com.wmspro.domain.audit.dto.UpdateCountsRequest;
import com.wmspro.domain.inventory.Inventory;
import com.wmspro.domain.inventory.InventoryRepository;
import com.wmspro.domain.stock.StockService;
import com.wmspro.domain.stock.StockTransaction;
import com.wmspro.domain.stock.dto.AdjustRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class InventoryAuditService {

    private final InventoryAuditRepository    auditRepo;
    private final InventoryRepository         invRepo;
    private final StockService                stockService;

    // ── 목록 조회 ──────────────────────────────────────────────
    @Transactional(readOnly = true)
    public List<InventoryAudit> list(UUID warehouseId) {
        return auditRepo.findByWarehouseId(warehouseId);
    }

    // ── 단건 조회 (항목 포함) ──────────────────────────────────
    @Transactional(readOnly = true)
    public InventoryAudit get(UUID id) {
        return auditRepo.findWithItems(id)
            .orElseThrow(() -> new BusinessException(ErrorCode.AUDIT_NOT_FOUND));
    }

    // ── 새 재고조사 생성 (현재 재고 스냅샷) ────────────────────
    @Transactional
    public InventoryAudit create(CreateAuditRequest req, UUID userId) {
        List<Inventory> snapshot = invRepo.findByWarehouseIdWithProductAndLocation(req.warehouseId);

        InventoryAudit audit = InventoryAudit.builder()
            .warehouseId(req.warehouseId)
            .auditDate(req.auditDate)
            .memo(req.memo)
            .status(InventoryAudit.AuditStatus.DRAFT)
            .createdBy(userId)
            .build();

        List<InventoryAuditItem> items = snapshot.stream()
            .map(inv -> InventoryAuditItem.builder()
                .audit(audit)
                .productId(inv.getProductId())
                .locationId(inv.getLocationId())
                .lotNumber(inv.getLotNumber())
                .systemQty(inv.getQuantity())
                .build())
            .collect(Collectors.toList());

        audit.getItems().addAll(items);
        return auditRepo.save(audit);
    }

    // ── 실사 수량 저장 ──────────────────────────────────────────
    @Transactional
    public void updateCounts(UUID auditId, UpdateCountsRequest req) {
        InventoryAudit audit = auditRepo.findWithItems(auditId)
            .orElseThrow(() -> new BusinessException(ErrorCode.AUDIT_NOT_FOUND));

        if (audit.getStatus() == InventoryAudit.AuditStatus.CONFIRMED) {
            throw new BusinessException(ErrorCode.ALREADY_CONFIRMED);
        }

        Map<UUID, InventoryAuditItem> itemMap = audit.getItems().stream()
            .collect(Collectors.toMap(InventoryAuditItem::getId, i -> i));

        for (UpdateCountsRequest.ItemCount c : req.getCounts()) {
            InventoryAuditItem item = itemMap.get(c.getItemId());
            if (item != null) item.setCountedQty(c.getCountedQty());
        }

        auditRepo.save(audit);
    }

    // ── 확정 → 재고 자동 차감/증가 ─────────────────────────────
    @Transactional
    public InventoryAudit confirm(UUID auditId, UUID userId) {
        InventoryAudit audit = auditRepo.findWithItems(auditId)
            .orElseThrow(() -> new BusinessException(ErrorCode.AUDIT_NOT_FOUND));

        if (audit.getStatus() == InventoryAudit.AuditStatus.CONFIRMED) {
            throw new BusinessException(ErrorCode.ALREADY_CONFIRMED);
        }

        for (InventoryAuditItem item : audit.getItems()) {
            if (item.getCountedQty() == null) continue;        // 미입력 항목 스킵
            if (item.getCountedQty().equals(item.getSystemQty())) continue; // 차이 없으면 스킵

            AdjustRequest adjustReq = new AdjustRequest();
            adjustReq.productId    = item.getProductId();
            adjustReq.locationId   = item.getLocationId();
            adjustReq.warehouseId  = audit.getWarehouseId();
            adjustReq.adjustedQty  = item.getCountedQty();
            adjustReq.lotNumber    = item.getLotNumber();
            adjustReq.reason       = "재고조사";
            adjustReq.referenceType = "INVENTORY_AUDIT";
            adjustReq.referenceId   = audit.getId();

            StockTransaction txn = stockService.adjust(adjustReq, userId);
            item.setTxnId(txn.getId());
        }

        audit.setStatus(InventoryAudit.AuditStatus.CONFIRMED);
        audit.setConfirmedAt(Instant.now());
        audit.setConfirmedBy(userId);
        return auditRepo.save(audit);
    }

    // ── 삭제 (DRAFT만) ─────────────────────────────────────────
    @Transactional
    public void delete(UUID auditId) {
        InventoryAudit audit = auditRepo.findById(auditId)
            .orElseThrow(() -> new BusinessException(ErrorCode.AUDIT_NOT_FOUND));

        if (audit.getStatus() == InventoryAudit.AuditStatus.CONFIRMED) {
            throw new BusinessException(ErrorCode.CANNOT_DELETE_CONFIRMED);
        }
        auditRepo.delete(audit);
    }
}
