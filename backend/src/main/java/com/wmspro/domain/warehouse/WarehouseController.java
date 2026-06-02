package com.wmspro.domain.warehouse;

import com.wmspro.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/warehouses")
@RequiredArgsConstructor
public class WarehouseController {

    private final WarehouseService warehouseService;

    @GetMapping
    public ApiResponse<List<Warehouse>> findAll() {
        return ApiResponse.ok(warehouseService.findAll());
    }

    @GetMapping("/{id}")
    public ApiResponse<Warehouse> findById(@PathVariable UUID id) {
        return ApiResponse.ok(warehouseService.findById(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Warehouse> create(@RequestBody Map<String, String> body) {
        return ApiResponse.ok(warehouseService.create(body.get("code"), body.get("name"), body.get("address")));
    }

    @GetMapping("/{id}/zones")
    public ApiResponse<List<Zone>> findZones(@PathVariable UUID id) {
        return ApiResponse.ok(warehouseService.findZones(id));
    }

    @PostMapping("/{id}/zones")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Zone> createZone(@PathVariable UUID id, @RequestBody Map<String, String> body) {
        ZoneType type = ZoneType.valueOf(body.getOrDefault("type", "STORAGE"));
        return ApiResponse.ok(warehouseService.createZone(id, body.get("code"), body.get("name"), type));
    }

    @GetMapping("/{id}/locations")
    public ApiResponse<List<Location>> findLocations(
        @PathVariable UUID id,
        @RequestParam(required = false) UUID zoneId
    ) {
        return ApiResponse.ok(warehouseService.findLocations(id, zoneId));
    }

    @PostMapping("/{id}/locations")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Location> createLocation(@PathVariable UUID id, @RequestBody Map<String, String> body) {
        return ApiResponse.ok(warehouseService.createLocation(
            id,
            UUID.fromString(body.get("zoneId")),
            body.get("code"),
            body.get("aisle"),
            body.get("rack"),
            body.get("shelf"),
            body.get("bin")
        ));
    }

    @PatchMapping("/locations/{locationId}")
    public ApiResponse<Location> updateLocation(
        @PathVariable UUID locationId,
        @RequestBody Map<String, Object> body
    ) {
        Boolean isActive     = body.containsKey("isActive") ? (Boolean) body.get("isActive") : null;
        Integer capacityUnit = body.containsKey("capacityUnit") ? (Integer) body.get("capacityUnit") : null;
        return ApiResponse.ok(warehouseService.updateLocation(locationId, isActive, capacityUnit));
    }

    @DeleteMapping("/{warehouseId}/zones/{zoneId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteZone(@PathVariable UUID warehouseId, @PathVariable UUID zoneId) {
        warehouseService.deleteZone(zoneId);
    }

    @DeleteMapping("/locations/{locationId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteLocation(@PathVariable UUID locationId) {
        warehouseService.deleteLocation(locationId);
    }
}
