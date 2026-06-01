package com.wmspro.common;

import lombok.Getter;
import org.springframework.data.domain.Page;

import java.util.List;

@Getter
public class PageResponse<T> {
    private final List<T> items;
    private final long    total;
    private final int     page;
    private final int     limit;
    private final int     totalPages;

    public PageResponse(Page<T> page, int limit) {
        this.items      = page.getContent();
        this.total      = page.getTotalElements();
        this.page       = page.getNumber() + 1;
        this.limit      = limit;
        this.totalPages = page.getTotalPages();
    }

    public PageResponse(List<T> items, long total, int page, int limit) {
        this.items      = items;
        this.total      = total;
        this.page       = page;
        this.limit      = limit;
        this.totalPages = (int) Math.ceil((double) total / limit);
    }
}
