package com.wmspro.common.audit;

import com.wmspro.common.ApiResponse;
import com.wmspro.common.PageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;

@RestController @RequestMapping("/api/v1/audit-logs") @RequiredArgsConstructor
public class AuditLogController {
    private final AuditLogService service;
    @GetMapping public ApiResponse<PageResponse<AuditLog>> findAll(@RequestParam(required = false) String search, @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "100") int limit) {
        return ApiResponse.ok(new PageResponse<>(service.findAll(search, page, limit), limit));
    }
    @PostMapping("/{id}/restore") public ApiResponse<Void> restore(@PathVariable UUID id) { service.restore(id); return ApiResponse.ok(null, "복원되었습니다"); }
}
