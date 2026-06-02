package com.wmspro.domain.inventory;

import com.wmspro.common.exception.BusinessException;
import com.wmspro.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class InventoryService {

    private final InventoryRepository invRepo;

    public List<Inventory> findByProduct(UUID productId, UUID warehouseId) {
        if (warehouseId != null) {
            return invRepo.findAvailableByProduct(productId, warehouseId);
        }
        return invRepo.findByProductIdAndQuantityGreaterThan(productId, -1);
    }

    public List<Inventory> findLowStock(UUID warehouseId) {
        return invRepo.findLowStock(warehouseId);
    }

    public List<Inventory> findAllByWarehouse(UUID warehouseId) {
        return invRepo.findByWarehouseIdWithProductAndLocation(warehouseId);
    }

    public Map<String, Object> getSummary(UUID warehouseId) {
        long totalSkus = invRepo.countDistinctProducts(warehouseId);
        long totalQty  = invRepo.sumQuantity(warehouseId);
        long lowStockCount = invRepo.findLowStock(warehouseId).size();
        return Map.of(
            "totalSkus",      totalSkus,
            "totalQty",       totalQty,
            "lowStockCount",  lowStockCount,
            "warehouseId",    warehouseId
        );
    }

    public Map<UUID, Long> getTotalStockByProduct() {
        Map<UUID, Long> result = new HashMap<>();
        for (Object[] row : invRepo.sumQuantityGroupByProduct()) {
            result.put((UUID) row[0], (Long) row[1]);
        }
        return result;
    }

    public Inventory findOrThrow(UUID id) {
        return invRepo.findById(id)
            .orElseThrow(() -> new BusinessException(ErrorCode.INVENTORY_NOT_FOUND));
    }
}
