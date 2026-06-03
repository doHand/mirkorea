package com.wmspro.domain.quote;

import com.wmspro.common.ApiResponse;
import com.wmspro.common.PageResponse;
import com.wmspro.common.security.WmsPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/quotes")
@RequiredArgsConstructor
public class QuoteController {

    private final QuoteService quoteService;

    @GetMapping
    public ApiResponse<PageResponse<Quote>> findAll(
        @RequestParam(required = false) String docType,
        @RequestParam(required = false) String search,
        @RequestParam(defaultValue = "1")  int page,
        @RequestParam(defaultValue = "50") int limit
    ) {
        return ApiResponse.ok(quoteService.findAll(docType, search, page, limit));
    }

    @GetMapping("/{id}")
    public ApiResponse<Quote> findById(@PathVariable UUID id) {
        return ApiResponse.ok(quoteService.findById(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Quote> create(
        @Valid @RequestBody QuoteRequest req,
        @AuthenticationPrincipal WmsPrincipal principal
    ) {
        return ApiResponse.ok(quoteService.create(req, principal.getUuid()), "문서 등록 완료");
    }

    @PutMapping("/{id}")
    public ApiResponse<Quote> update(
        @PathVariable UUID id,
        @Valid @RequestBody QuoteRequest req
    ) {
        return ApiResponse.ok(quoteService.update(id, req));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        quoteService.delete(id);
        return ApiResponse.ok(null, "문서 삭제 완료");
    }
}
