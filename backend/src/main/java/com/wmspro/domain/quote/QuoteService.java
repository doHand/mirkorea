package com.wmspro.domain.quote;

import com.wmspro.common.PageResponse;
import com.wmspro.common.exception.BusinessException;
import com.wmspro.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class QuoteService {

    private final QuoteRepository repo;
    private final JdbcTemplate    jdbcTemplate;

    public PageResponse<Quote> findAll(String docType, String search, String status, LocalDate dateFrom, LocalDate dateTo, int page, int limit) {
        String dt = (docType != null && !docType.isBlank()) ? docType : null;
        String q  = (search  != null && !search.isBlank())  ? search  : null;
        String st = (status != null && !status.isBlank()) ? status : null;
        Page<Quote> p = repo.search(dt, q, st, dateFrom, dateTo, PageRequest.of(page - 1, limit));
        return new PageResponse<>(p, limit);
    }

    public Quote findById(UUID id) {
        return repo.findById(id)
            .orElseThrow(() -> new BusinessException(ErrorCode.QUOTE_NOT_FOUND));
    }

    @Transactional
    public Quote create(QuoteRequest req, UUID userId) {
        String docType = (req.docType != null && !req.docType.isBlank()) ? req.docType : "STATEMENT";
        Quote quote = Quote.builder()
            .docNo(generateDocNo(docType))
            .docType(docType)
            .clientId(req.clientId)
            .clientName(req.clientName)
            .docDate(req.docDate != null ? req.docDate : LocalDate.now())
            .memo(req.memo)
            .createdBy(userId)
            .build();

        applyItems(quote, req.items);
        return repo.save(quote);
    }

    @Transactional
    public Quote update(UUID id, QuoteRequest req) {
        Quote quote = findById(id);
        quote.setClientId(req.clientId);
        quote.setClientName(req.clientName);
        if (req.docDate != null) quote.setDocDate(req.docDate);
        quote.setMemo(req.memo);
        quote.getItems().clear();
        applyItems(quote, req.items);
        return repo.save(quote);
    }

    @Transactional
    public void delete(UUID id) {
        if (!repo.existsById(id)) throw new BusinessException(ErrorCode.QUOTE_NOT_FOUND);
        repo.deleteById(id);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private void applyItems(Quote quote, List<QuoteRequest.ItemReq> items) {
        if (items == null) return;
        BigDecimal total = BigDecimal.ZERO;
        for (int i = 0; i < items.size(); i++) {
            QuoteRequest.ItemReq ir = items.get(i);
            BigDecimal up     = ir.unitPrice != null ? ir.unitPrice : BigDecimal.ZERO;
            BigDecimal amount = up.multiply(BigDecimal.valueOf(ir.qty));
            QuoteItem item = QuoteItem.builder()
                .quote(quote)
                .productId(ir.productId)
                .productCode(ir.productCode)
                .productName(ir.productName)
                .category(ir.category)
                .barcode(ir.barcode)
                .spec(ir.spec)
                .inUnitQty(ir.inUnitQty)
                .outUnitQty(ir.outUnitQty)
                .unit(ir.unit)
                .qty(ir.qty)
                .unitPrice(up)
                .amount(amount)
                .sortOrder(i)
                .build();
            quote.getItems().add(item);
            total = total.add(amount);
        }
        quote.setTotalAmount(total);
    }

    private String generateDocNo(String docType) {
        String prefix  = "STATEMENT".equals(docType) ? "명세" : "견적";
        String dateStr = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        Long   seq     = jdbcTemplate.queryForObject("SELECT nextval('quote_seq')", Long.class);
        return prefix + "-" + dateStr + "-" + String.format("%04d", seq);
    }
}
