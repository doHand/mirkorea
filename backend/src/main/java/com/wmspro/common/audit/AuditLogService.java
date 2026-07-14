package com.wmspro.common.audit;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.wmspro.domain.client.ClientService;
import com.wmspro.domain.product.ProductService;
import com.wmspro.domain.user.UserRepository;
import com.wmspro.common.exception.BusinessException;
import com.wmspro.common.exception.ErrorCode;
import com.wmspro.common.sse.SseService;
import jakarta.persistence.criteria.Predicate;
import java.util.UUID;
import java.util.ArrayList;
import java.util.Locale;

@Service @RequiredArgsConstructor
public class AuditLogService {
    private static final int MAX_AUDIT_LOGS = 100;

    private final AuditLogRepository repository;
    private final ProductService productService;
    private final ClientService clientService;
    private final UserRepository userRepository;
    private final SseService sseService;

    @Transactional
    public void record(String action, String path, String actor) {
        if (path.startsWith("/api/v1/audit-logs")) return;
        String[] parts = path.split("/");
        String targetType = parts.length > 3 ? parts[3] : "system";
        String targetId = parts.length > 4 ? parts[4] : null;
        String displayActor = resolveActor(actor);
        repository.save(AuditLog.builder().action(action).targetType(targetType).targetId(targetId)
            .summary(action + " · " + targetType).actor(displayActor).requestPath(path).build());
        repository.deleteOlderThanLatest(MAX_AUDIT_LOGS);
        sseService.broadcast("audit");
    }

    private String resolveActor(String actor) {
        if (actor == null || actor.isBlank() || "system".equals(actor)) return "system";
        return userRepository.findByUsernameOrEmail(actor)
            .map(user -> user.getFullName() + " (" + user.getUsername() + ")")
            .orElse(actor);
    }

    @Transactional(readOnly = true)
    public Page<AuditLog> findAll(String search, String action, int page, int limit) {
        var pageable = PageRequest.of(Math.max(0, page - 1), Math.min(100, Math.max(1, limit)), Sort.by("createdAt").descending());
        Specification<AuditLog> spec = (root, query, cb) -> {
            var predicates = new ArrayList<Predicate>();
            if (action != null && !action.isBlank()) {
                if ("UPDATE".equals(action)) {
                    predicates.add(root.get("action").in("PUT", "PATCH"));
                } else {
                    predicates.add(cb.equal(root.get("action"), action));
                }
            }
            if (search != null && !search.isBlank()) {
                String q = "%" + search.toLowerCase(Locale.ROOT) + "%";
                predicates.add(cb.or(
                    cb.like(cb.lower(root.get("action")), q),
                    cb.like(cb.lower(root.get("targetType")), q),
                    cb.like(cb.lower(root.get("targetId")), q),
                    cb.like(cb.lower(root.get("summary")), q),
                    cb.like(cb.lower(root.get("actor")), q),
                    cb.like(cb.lower(root.get("requestPath")), q)
                ));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
        return repository.findAll(spec, pageable);
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
    public int purgeOverflow() {
        return repository.deleteOlderThanLatest(MAX_AUDIT_LOGS);
    }
}
