package com.wmspro.domain.user;

import com.wmspro.common.ApiResponse;
import com.wmspro.common.exception.BusinessException;
import com.wmspro.common.exception.ErrorCode;
import com.wmspro.common.security.WmsPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.Setter;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository  userRepo;
    private final PasswordEncoder passwordEncoder;

    // ── 내 계정 (모든 인증 사용자) ───────────────────────────────────────

    @GetMapping("/me")
    public ApiResponse<Map<String, Object>> getMe(@AuthenticationPrincipal WmsPrincipal principal) {
        User user = userRepo.findById(principal.getUuid())
            .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
        return ApiResponse.ok(toMap(user));
    }

    @PatchMapping("/me")
    public ApiResponse<Map<String, Object>> updateMe(
        @AuthenticationPrincipal WmsPrincipal principal,
        @RequestBody UpdateMeRequest req
    ) {
        User user = userRepo.findById(principal.getUuid())
            .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
        if (req.getFullName() != null && !req.getFullName().isBlank())
            user.setFullName(req.getFullName());
        if (req.getPassword() != null && !req.getPassword().isBlank())
            user.setPasswordHash(passwordEncoder.encode(req.getPassword()));
        return ApiResponse.ok(toMap(userRepo.save(user)));
    }

    // ── 관리자 전용 ──────────────────────────────────────────────────────

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<List<Map<String, Object>>> findAll() {
        return ApiResponse.ok(userRepo.findAll().stream().map(this::toMap).toList());
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Map<String, Object>> create(@Valid @RequestBody CreateRequest req) {
        if (userRepo.existsByUsername(req.getUsername()))
            throw new BusinessException(ErrorCode.USER_DUPLICATE);
        if (userRepo.existsByEmail(req.getEmail()))
            throw new BusinessException(ErrorCode.USER_DUPLICATE);

        User saved = userRepo.save(User.builder()
            .username(req.getUsername())
            .email(req.getEmail())
            .passwordHash(passwordEncoder.encode(req.getPassword()))
            .fullName(req.getFullName())
            .role(UserRole.valueOf(req.getRole()))
            .warehouseId(req.getWarehouseId() != null && !req.getWarehouseId().isBlank()
                ? UUID.fromString(req.getWarehouseId()) : null)
            .build());
        return ApiResponse.ok(toMap(saved));
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Map<String, Object>> update(@PathVariable UUID id,
                                                    @RequestBody UpdateRequest req) {
        User user = userRepo.findById(id)
            .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

        if (req.getFullName()    != null) user.setFullName(req.getFullName());
        if (req.getRole()        != null) user.setRole(UserRole.valueOf(req.getRole()));
        if (req.getIsActive()    != null) user.setActive(req.getIsActive());
        if (req.getWarehouseId() != null)
            user.setWarehouseId(req.getWarehouseId().isBlank()
                ? null : UUID.fromString(req.getWarehouseId()));
        if (req.getPassword() != null && !req.getPassword().isBlank())
            user.setPasswordHash(passwordEncoder.encode(req.getPassword()));

        return ApiResponse.ok(toMap(userRepo.save(user)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        if (!userRepo.existsById(id))
            throw new BusinessException(ErrorCode.USER_NOT_FOUND);
        userRepo.deleteById(id);
        return ApiResponse.ok(null);
    }

    private Map<String, Object> toMap(User u) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id",          u.getId().toString());
        m.put("username",    u.getUsername());
        m.put("email",       u.getEmail());
        m.put("fullName",    u.getFullName());
        m.put("role",        u.getRole().name());
        m.put("warehouseId", u.getWarehouseId() != null ? u.getWarehouseId().toString() : null);
        m.put("isActive",    u.isActive());
        m.put("lastLoginAt", u.getLastLoginAt() != null ? u.getLastLoginAt().toString() : null);
        m.put("createdAt",   u.getCreatedAt().toString());
        return m;
    }

    @Getter @Setter
    public static class UpdateMeRequest {
        String fullName;
        String password;
    }

    @Getter @Setter
    public static class CreateRequest {
        @NotBlank String username;
        @NotBlank @Email String email;
        @NotBlank String password;
        @NotBlank String fullName;
        @NotBlank String role;
        String warehouseId;
    }

    @Getter @Setter
    public static class UpdateRequest {
        String fullName;
        String role;
        Boolean isActive;
        String warehouseId;
        String password;
    }
}
