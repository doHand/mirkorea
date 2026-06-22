package com.wmspro.common.audit;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;

@Component @Order(Ordered.LOWEST_PRECEDENCE) @RequiredArgsConstructor
public class AuditLogFilter extends OncePerRequestFilter {
    private final AuditLogService auditLogService;
    @Override protected boolean shouldNotFilter(HttpServletRequest request) { return !request.getRequestURI().startsWith("/api/v1/") || "GET".equals(request.getMethod()); }
    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
        chain.doFilter(request, response);
        if (response.getStatus() < 400) auditLogService.record(request.getMethod(), request.getRequestURI(), request.getUserPrincipal() == null ? "system" : request.getUserPrincipal().getName());
    }
}
