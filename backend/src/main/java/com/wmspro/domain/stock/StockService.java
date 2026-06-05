package com.wmspro.domain.stock;

import com.wmspro.common.exception.BusinessException;
import com.wmspro.common.exception.ErrorCode;
import com.wmspro.domain.inventory.Inventory;
import com.wmspro.domain.inventory.InventoryRepository;
import com.wmspro.domain.stock.dto.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class StockService {

    private final StockTransactionRepository txnRepo;
    private final InventoryRepository        invRepo;
    private final JdbcTemplate               jdbcTemplate;

    // ────────────────────────────────────────────────────────────
    // 입고
    // ────────────────────────────────────────────────────────────
    @Transactional
    public StockTransaction inbound(InboundRequest req, UUID userId) {
        Optional<Inventory> invOpt = lockInventory(req.productId, req.locationId, req.lotNumber);

        int beforeQty = invOpt.map(Inventory::getQuantity).orElse(0);
        int afterQty  = beforeQty + req.quantity;
        assertNotNegative(afterQty, "inbound");

        if (invOpt.isPresent()) {
            Inventory inv = invOpt.get();
            inv.setQuantity(afterQty);
            inv.setLastSyncedAt(Instant.now());
            invRepo.save(inv);
        } else {
            invRepo.save(Inventory.builder()
                .productId(req.productId)
                .locationId(req.locationId)
                .warehouseId(req.warehouseId)
                .quantity(req.quantity)
                .lotNumber(req.lotNumber)
                .expireDate(req.expireDate)
                .lastSyncedAt(Instant.now())
                .build());
        }

        return saveTxn(StockTransaction.builder()
            .txType(TxType.INBOUND)
            .qty(req.quantity)
            .qtyBefore(beforeQty)
            .qtyAfter(afterQty)
            .productId(req.productId)
            .locationId(req.locationId)
            .warehouseId(req.warehouseId)
            .barcodeScanned(req.barcodeUsed)
            .lotNumber(req.lotNumber)
            .expiryDate(req.expireDate)
            .reason(req.reason)
            .memo(req.memo)
            .createdBy(userId)
            .build());
    }

    // ────────────────────────────────────────────────────────────
    // 출고 — 비관적 락 필수
    // ────────────────────────────────────────────────────────────
    @Transactional
    public StockTransaction outbound(OutboundRequest req, UUID userId) {
        Inventory inv = lockInventory(req.productId, req.locationId, req.lotNumber)
            .orElseThrow(() -> new BusinessException(ErrorCode.INVENTORY_NOT_FOUND));

        assertSufficient(inv, req.quantity);

        int beforeQty = inv.getQuantity();
        int afterQty  = beforeQty - req.quantity;
        assertNotNegative(afterQty, "outbound");

        inv.setQuantity(afterQty);
        inv.setLastSyncedAt(Instant.now());
        invRepo.save(inv);

        return saveTxn(StockTransaction.builder()
            .txType(TxType.OUTBOUND)
            .qty(-req.quantity)
            .qtyBefore(beforeQty)
            .qtyAfter(afterQty)
            .productId(req.productId)
            .locationId(req.locationId)
            .warehouseId(req.warehouseId)
            .barcodeScanned(req.barcodeUsed)
            .lotNumber(req.lotNumber)
            .reason(req.reason)
            .memo(req.memo)
            .createdBy(userId)
            .build());
    }

    // ────────────────────────────────────────────────────────────
    // 재고 조정
    // ────────────────────────────────────────────────────────────
    @Transactional
    public StockTransaction adjust(AdjustRequest req, UUID userId) {
        assertNotNegative(req.adjustedQty, "adjustment");

        Optional<Inventory> invOpt = lockInventory(req.productId, req.locationId, req.lotNumber);
        int beforeQty = invOpt.map(Inventory::getQuantity).orElse(0);
        int delta     = req.adjustedQty - beforeQty;

        if (invOpt.isPresent()) {
            Inventory inv = invOpt.get();
            inv.setQuantity(req.adjustedQty);
            inv.setLastSyncedAt(Instant.now());
            invRepo.save(inv);
        } else {
            invRepo.save(Inventory.builder()
                .productId(req.productId)
                .locationId(req.locationId)
                .warehouseId(req.warehouseId)
                .quantity(req.adjustedQty)
                .lotNumber(req.lotNumber)
                .lastSyncedAt(Instant.now())
                .build());
        }

        TxType txType = delta >= 0 ? TxType.ADJUST_INCREASE : TxType.ADJUST_DECREASE;

        return saveTxn(StockTransaction.builder()
            .txType(txType)
            .qty(delta)
            .qtyBefore(beforeQty)
            .qtyAfter(req.adjustedQty)
            .productId(req.productId)
            .locationId(req.locationId)
            .warehouseId(req.warehouseId)
            .lotNumber(req.lotNumber)
            .reason(req.reason)
            .memo(req.memo)
            .createdBy(userId)
            .build());
    }

    // ────────────────────────────────────────────────────────────
    // 위치 이동 — 데드락 방지: locationId 오름차순으로 락 획득
    // ────────────────────────────────────────────────────────────
    @Transactional
    public void move(MoveRequest req, UUID userId) {
        if (req.fromLocationId.equals(req.toLocationId)) {
            throw new BusinessException(ErrorCode.SAME_LOCATION);
        }

        // 항상 정렬된 순서로 락 획득
        List<UUID> sortedIds = List.of(req.fromLocationId, req.toLocationId)
            .stream().sorted().toList();

        List<Inventory> locked = invRepo.findWithLockMultiple(req.productId, sortedIds);

        Inventory fromInv = locked.stream()
            .filter(i -> i.getLocationId().equals(req.fromLocationId))
            .findFirst()
            .orElseThrow(() -> new BusinessException(ErrorCode.INVENTORY_NOT_FOUND));

        Inventory toInv = locked.stream()
            .filter(i -> i.getLocationId().equals(req.toLocationId))
            .findFirst()
            .orElse(null);

        assertSufficient(fromInv, req.quantity);

        int fromBefore = fromInv.getQuantity();
        int fromAfter  = fromBefore - req.quantity;
        int toBefore   = toInv != null ? toInv.getQuantity() : 0;
        int toAfter    = toBefore + req.quantity;

        fromInv.setQuantity(fromAfter);
        fromInv.setLastSyncedAt(Instant.now());
        invRepo.save(fromInv);

        if (toInv != null) {
            toInv.setQuantity(toAfter);
            toInv.setLastSyncedAt(Instant.now());
            invRepo.save(toInv);
        } else {
            invRepo.save(Inventory.builder()
                .productId(req.productId)
                .locationId(req.toLocationId)
                .warehouseId(req.warehouseId)
                .quantity(req.quantity)
                .lotNumber(req.lotNumber)
                .lastSyncedAt(Instant.now())
                .build());
        }

        StockTransaction moveOut = saveTxn(StockTransaction.builder()
            .txType(TxType.MOVE_OUT)
            .qty(-req.quantity)
            .qtyBefore(fromBefore)
            .qtyAfter(fromAfter)
            .productId(req.productId)
            .locationId(req.fromLocationId)
            .warehouseId(req.warehouseId)
            .reason(req.reason)
            .createdBy(userId)
            .build());

        saveTxn(StockTransaction.builder()
            .txType(TxType.MOVE_IN)
            .qty(req.quantity)
            .qtyBefore(toBefore)
            .qtyAfter(toAfter)
            .productId(req.productId)
            .locationId(req.toLocationId)
            .warehouseId(req.warehouseId)
            .referenceId(moveOut.getId())
            .referenceType("MOVE_OUT")
            .reason(req.reason)
            .createdBy(userId)
            .build());
    }

    // ────────────────────────────────────────────────────────────
    // 입고 취소
    // ────────────────────────────────────────────────────────────
    @Transactional
    public StockTransaction cancelInbound(UUID txnId, String reason, UUID userId) {
        StockTransaction original = txnRepo.findWithLock(txnId)
            .orElseThrow(() -> new BusinessException(ErrorCode.TRANSACTION_NOT_FOUND));

        if (original.isCancelled()) throw new BusinessException(ErrorCode.ALREADY_CANCELLED);
        if (original.getTxType() != TxType.INBOUND) throw new BusinessException(ErrorCode.INVALID_TX_TYPE);

        Inventory inv = lockInventory(original.getProductId(), original.getLocationId(), original.getLotNumber())
            .orElseThrow(() -> new BusinessException(ErrorCode.INVENTORY_NOT_FOUND));

        if (inv.getQuantity() < original.getQty()) {
            throw new BusinessException(ErrorCode.CANNOT_CANCEL);
        }

        int beforeQty = inv.getQuantity();
        int afterQty  = beforeQty - original.getQty();
        assertNotNegative(afterQty, "cancel inbound");

        inv.setQuantity(afterQty);
        invRepo.save(inv);

        original.setCancelled(true);
        original.setCancelledBy(userId);
        original.setCancelledAt(Instant.now());
        txnRepo.save(original);

        return saveTxn(StockTransaction.builder()
            .txType(TxType.INBOUND_CANCEL)
            .qty(-original.getQty())
            .qtyBefore(beforeQty)
            .qtyAfter(afterQty)
            .productId(original.getProductId())
            .locationId(original.getLocationId())
            .warehouseId(original.getWarehouseId())
            .referenceId(txnId)
            .referenceType("INBOUND")
            .reason(reason)
            .createdBy(userId)
            .build());
    }

    // ────────────────────────────────────────────────────────────
    // 출고 취소
    // ────────────────────────────────────────────────────────────
    @Transactional
    public StockTransaction cancelOutbound(UUID txnId, String reason, UUID userId) {
        StockTransaction original = txnRepo.findWithLock(txnId)
            .orElseThrow(() -> new BusinessException(ErrorCode.TRANSACTION_NOT_FOUND));

        if (original.isCancelled()) throw new BusinessException(ErrorCode.ALREADY_CANCELLED);
        if (original.getTxType() != TxType.OUTBOUND) throw new BusinessException(ErrorCode.INVALID_TX_TYPE);

        Optional<Inventory> invOpt = lockInventory(original.getProductId(), original.getLocationId(), original.getLotNumber());

        int cancelQty = Math.abs(original.getQty());
        int beforeQty = invOpt.map(Inventory::getQuantity).orElse(0);
        int afterQty  = beforeQty + cancelQty;

        if (invOpt.isPresent()) {
            Inventory inv = invOpt.get();
            inv.setQuantity(afterQty);
            inv.setLastSyncedAt(Instant.now());
            invRepo.save(inv);
        } else {
            invRepo.save(Inventory.builder()
                .productId(original.getProductId())
                .locationId(original.getLocationId())
                .warehouseId(original.getWarehouseId())
                .quantity(cancelQty)
                .lotNumber(original.getLotNumber())
                .lastSyncedAt(Instant.now())
                .build());
        }

        original.setCancelled(true);
        original.setCancelledBy(userId);
        original.setCancelledAt(Instant.now());
        txnRepo.save(original);

        return saveTxn(StockTransaction.builder()
            .txType(TxType.OUTBOUND_CANCEL)
            .qty(cancelQty)
            .qtyBefore(beforeQty)
            .qtyAfter(afterQty)
            .productId(original.getProductId())
            .locationId(original.getLocationId())
            .warehouseId(original.getWarehouseId())
            .referenceId(txnId)
            .referenceType("OUTBOUND")
            .reason(reason)
            .createdBy(userId)
            .build());
    }

    // ────────────────────────────────────────────────────────────
    // Private helpers
    // ────────────────────────────────────────────────────────────
    private Optional<Inventory> lockInventory(UUID productId, UUID locationId, String lotNumber) {
        if (lotNumber != null && !lotNumber.isBlank()) {
            return invRepo.findWithLockAndLot(productId, locationId, lotNumber);
        }
        return invRepo.findWithLock(productId, locationId);
    }

    private void assertSufficient(Inventory inv, int requested) {
        int available = inv.getAvailableQty();
        if (available < requested) {
            throw new BusinessException(ErrorCode.INSUFFICIENT_STOCK,
                java.util.Map.of(
                    "available", available,
                    "requested", requested,
                    "locationId", inv.getLocationId()
                ));
        }
    }

    private void assertNotNegative(int qty, String context) {
        if (qty < 0) throw new BusinessException(ErrorCode.STOCK_NEGATIVE);
    }

    private StockTransaction saveTxn(StockTransaction txn) {
        // 정합성 검증: before + delta == after
        if (txn.getQtyBefore() + txn.getQty() != txn.getQtyAfter()) {
            log.error("재고 정합성 오류: before={}, qty={}, after={}",
                txn.getQtyBefore(), txn.getQty(), txn.getQtyAfter());
            throw new BusinessException(ErrorCode.STOCK_INTEGRITY_ERROR);
        }
        txn.setTxnNo(generateTxnNo());
        return txnRepo.save(txn);
    }

    private String generateTxnNo() {
        Long seq = jdbcTemplate.queryForObject("SELECT nextval('txn_seq')", Long.class);
        String date = LocalDate.now(ZoneId.of("Asia/Seoul"))
            .format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        return String.format("TXN-%s-%06d", date, seq);
    }
}
