package com.wmspro.common.audit;

import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component @RequiredArgsConstructor
public class AuditRetentionScheduler {
    private final AuditLogService auditLogService;
    @Scheduled(cron = "0 10 3 * * *")
    public void purgeOverflowAuditLogs() { auditLogService.purgeOverflow(); }
}
