package com.wmspro.domain.auth;

import com.wmspro.common.ApiResponse;
import com.wmspro.common.exception.BusinessException;
import com.wmspro.common.exception.ErrorCode;
import com.wmspro.common.security.WmsPrincipal;
import com.wmspro.domain.user.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.Setter;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService    authService;
    private final UserRepository userRepo;

    @PostMapping("/login")
    public ApiResponse<Map<String, Object>> login(@Valid @RequestBody LoginRequest req) {
        return ApiResponse.ok(authService.login(req.username, req.password));
    }

    @PostMapping("/refresh")
    public ApiResponse<Map<String, Object>> refresh(@RequestBody Map<String, String> body) {
        return ApiResponse.ok(authService.refresh(body.get("refreshToken")));
    }

    @GetMapping("/me")
    public ApiResponse<Map<String, Object>> me(@AuthenticationPrincipal WmsPrincipal principal) {
        var user = userRepo.findById(principal.getUuid())
            .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
        return ApiResponse.ok(Map.of(
            "id",          user.getId().toString(),
            "username",    user.getUsername(),
            "fullName",    user.getFullName(),
            "role",        user.getRole().name(),
            "warehouseId", user.getWarehouseId() != null ? user.getWarehouseId().toString() : ""
        ));
    }

    @Getter @Setter
    static class LoginRequest {
        @NotBlank String username;
        @NotBlank String password;
    }
}
