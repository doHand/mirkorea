package com.wmspro.domain.client;

import com.wmspro.common.ApiResponse;
import com.wmspro.common.PageResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/clients")
@RequiredArgsConstructor
public class ClientController {

    private final ClientService clientService;

    @GetMapping
    public ApiResponse<PageResponse<Client>> findAll(
        @RequestParam(required = false) String search,
        @RequestParam(defaultValue = "1")  int page,
        @RequestParam(defaultValue = "50") int limit
    ) {
        return ApiResponse.ok(clientService.findAll(search, page, limit));
    }

    @GetMapping("/all")
    public ApiResponse<List<Client>> findAllActive() {
        return ApiResponse.ok(clientService.findAllActive());
    }

    @GetMapping("/{id}")
    public ApiResponse<Client> findById(@PathVariable UUID id) {
        return ApiResponse.ok(clientService.findById(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Client> create(@Valid @RequestBody ClientRequest req) {
        return ApiResponse.ok(clientService.create(req), "거래처 등록 완료");
    }

    @PutMapping("/{id}")
    public ApiResponse<Client> update(@PathVariable UUID id, @Valid @RequestBody ClientRequest req) {
        return ApiResponse.ok(clientService.update(id, req));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        clientService.delete(id);
        return ApiResponse.ok(null, "거래처 삭제 완료");
    }
}
