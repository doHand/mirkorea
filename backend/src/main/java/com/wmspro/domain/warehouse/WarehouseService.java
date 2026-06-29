package com.wmspro.domain.warehouse;

import com.wmspro.common.exception.BusinessException;
import com.wmspro.common.exception.ErrorCode;
import com.wmspro.domain.inventory.InventoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class WarehouseService {

    private final WarehouseRepository warehouseRepo;
    private final ZoneRepository      zoneRepo;
    private final LocationRepository  locationRepo;
    private final InventoryRepository inventoryRepo;

    public List<Warehouse> findAll() {
        return warehouseRepo.findByIsActiveTrueOrderByName();
    }

    public Warehouse findById(UUID id) {
        return warehouseRepo.findById(id)
            .orElseThrow(() -> new BusinessException(ErrorCode.WAREHOUSE_NOT_FOUND));
    }

    @Transactional
    public Warehouse create(String code, String name, String address) {
        if (warehouseRepo.existsByCode(code)) {
            throw new BusinessException(ErrorCode.WAREHOUSE_CODE_DUPLICATE);
        }
        return warehouseRepo.save(Warehouse.builder().code(code).name(name).address(address).build());
    }

    public List<Zone> findZones(UUID warehouseId) {
        return zoneRepo.findByWarehouseIdAndIsActiveTrueOrderByCode(warehouseId);
    }

    @Transactional
    public Zone createZone(UUID warehouseId, String code, String name, ZoneType type) {
        return zoneRepo.save(Zone.builder()
            .warehouseId(warehouseId).code(code).name(name).type(type).build());
    }

    public List<Location> findAllLocations() {
        return locationRepo.findByIsActiveTrueOrderByCode();
    }

    public List<Location> findLocations(UUID warehouseId, UUID zoneId) {
        if (zoneId != null) {
            return locationRepo.findByZoneIdAndIsActiveTrueOrderByCode(zoneId);
        }
        return locationRepo.findByWarehouseIdAndIsActiveTrueOrderByCode(warehouseId);
    }

    public Location findLocation(UUID id) {
        return locationRepo.findById(id)
            .orElseThrow(() -> new BusinessException(ErrorCode.LOCATION_NOT_FOUND));
    }

    @Transactional
    public Location createLocation(UUID warehouseId, UUID zoneId, String code,
                                    String aisle, String rack, String shelf, String bin) {
        if (locationRepo.existsByCode(code)) {
            throw new BusinessException(ErrorCode.LOCATION_CODE_DUPLICATE);
        }
        return locationRepo.save(Location.builder()
            .warehouseId(warehouseId).zoneId(zoneId).code(code)
            .aisle(aisle).rack(rack).shelf(shelf).bin(bin).build());
    }

    @Transactional
    public Location updateLocation(UUID id, Boolean isActive, Integer capacityUnit,
                                   Integer putawayPriority, Integer pickPriority, Boolean allowMixedProducts) {
        Location loc = findLocation(id);
        if (isActive     != null) loc.setActive(isActive);
        if (capacityUnit != null) loc.setCapacityUnit(capacityUnit);
        if (putawayPriority != null) loc.setPutawayPriority(Math.max(0, putawayPriority));
        if (pickPriority != null) loc.setPickPriority(Math.max(0, pickPriority));
        if (allowMixedProducts != null) loc.setAllowMixedProducts(allowMixedProducts);
        return locationRepo.save(loc);
    }

    @Transactional
    public void deleteZone(UUID zoneId) {
        Zone zone = zoneRepo.findById(zoneId)
            .orElseThrow(() -> new BusinessException(ErrorCode.ZONE_NOT_FOUND));
        if (locationRepo.countByZoneIdAndIsActiveTrue(zoneId) > 0) {
            throw new BusinessException(ErrorCode.ZONE_HAS_LOCATIONS);
        }
        zone.setActive(false);
        zoneRepo.save(zone);
    }

    @Transactional
    public void deleteLocation(UUID locationId) {
        Location loc = findLocation(locationId);
        if (inventoryRepo.existsByLocationIdAndQuantityGreaterThan(locationId, 0)) {
            throw new BusinessException(ErrorCode.LOCATION_HAS_INVENTORY);
        }
        loc.setActive(false);
        locationRepo.save(loc);
    }
}
