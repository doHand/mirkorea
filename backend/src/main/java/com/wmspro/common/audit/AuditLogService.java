package com.wmspro.common.audit;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.wmspro.domain.client.ClientService;
import com.wmspro.domain.product.ProductService;
import com.wmspro.common.exception.BusinessException;
import com.wmspro.common.exception.ErrorCode;
import com.wmspro.common.sse.SseService;
import java.util.UUID;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

@Service @RequiredArgsConstructor
public class AuditLogService {
    private final AuditLogRepository repository;
    private final ProductService productService;
    private final ClientService clientService;
    private final SseService sseService;

    @Transactional
    public void record(String action, String path, String actor) {
        if (path.startsWith("/api/v1/audit-logs")) return;
        String[] parts = path.split("/");
        String targetType = parts.length > 3 ? parts[3] : "system";
        String targetId = parts.length > 4 ? parts[4] : null;
        repository.save(AuditLog.builder().action(action).targetType(targetType).targetId(targetId)
            .summary(action + " · " + targetType).actor(actor).requestPath(path).build());
        sseService.broadcast("audit");
    }

    @Transactional(readOnly = true)
    public Page<AuditLog> findAll(String search, int page, int limit) {
        var pageable = PageRequest.of(Math.max(0, page - 1), Math.min(100, Math.max(1, limit)), Sort.by("createdAt").descending());
        if (search == null || search.isBlank()) return repository.findAll(pageable);
        return repository.findByActionContainingIgnoreCaseOrTargetTypeContainingIgnoreCase(search, search, pageable);
    }

    @Transactional
    public void restore(UUID auditLogId) {
        AuditLog log = repository.findById(auditLogId).orElseThrow(() -> new BusinessException(ErrorCode.INVALID_REQUEST));
        if (!"DELETE".equals(log.getAction()) || log.getTargetId() == null) throw new BusinessException(ErrorCode.INVALID_REQUEST);
        UUID id = UUID.fromString(log.getTargetId());
        switch (log.getTargetType()) {
            case "products" -> productService.restore(id);
            case "clients" -> clientService.restore(id);
            default -> throw new BusinessException(ErrorCode.INVALID_REQUEST);
        }
        log.setSummary(log.getSummary() + " · 복원됨");
    }

    @Transactional
    public long purgeExpired() {
        return repository.deleteByCreatedAtBefore(Instant.now().minus(30, ChronoUnit.DAYS));
    }
}
