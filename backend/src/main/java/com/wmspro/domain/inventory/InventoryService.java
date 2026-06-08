package com.wmspro.domain.inventory;

import com.wmspro.common.exception.BusinessException;
import com.wmspro.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.ArrayList;
import java.util.LinkedHashMap;
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

    public List<Map<String, Object>> findLowStock(UUID warehouseId) {
        Map<UUID, List<Inventory>> byProduct = new LinkedHashMap<>();
        for (Inventory inventory : invRepo.findByWarehouseIdWithProductAndLocation(warehouseId)) {
            byProduct.computeIfAbsent(inventory.getProductId(), ignored -> new ArrayList<>()).add(inventory);
        }

        List<Map<String, Object>> result = new ArrayList<>();
        for (List<Inventory> items : byProduct.values()) {
            Inventory representative = items.get(0);
            long totalQuantity = items.stream().mapToLong(Inventory::getQuantity).sum();
            int safetyStock = representative.getProduct().getSafetyStock();
            if (safetyStock <= 0 || totalQuantity >= safetyStock) continue;

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", representative.getId());
            row.put("productId", representative.getProductId());
            row.put("warehouseId", representative.getWarehouseId());
            row.put("locationId", representative.getLocationId());
            row.put("quantity", totalQuantity);
            row.put("reservedQty", items.stream().mapToLong(Inventory::getReservedQty).sum());
            row.put("product", representative.getProduct());
            row.put("location", representative.getLocation());
            result.add(row);
        }
        return result;
    }

    public List<Inventory> findAllByWarehouse(UUID warehouseId) {
        return invRepo.findByWarehouseIdWithProductAndLocation(warehouseId);
    }

    public Map<String, Object> getSummary(UUID warehouseId) {
        long totalSkus = invRepo.countDistinctProducts(warehouseId);
        long totalQty  = invRepo.sumQuantity(warehouseId);
        long lowStockCount = findLowStock(warehouseId).size();
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
            Number n = (Number) row[1];
            result.put((UUID) row[0], n != null ? n.longValue() : 0L);
        }
        return result;
    }

    public Inventory findOrThrow(UUID id) {
        return invRepo.findById(id)
            .orElseThrow(() -> new BusinessException(ErrorCode.INVENTORY_NOT_FOUND));
    }
}
