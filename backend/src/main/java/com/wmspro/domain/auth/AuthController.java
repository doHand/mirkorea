package com.wmspro.domain.auth;

import com.wmspro.common.ApiResponse;
import com.wmspro.common.security.WmsPrincipal;
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

    private final AuthService authService;

    @PostMapping("/login")
    public ApiResponse<Map<String, Object>> login(@Valid @RequestBody LoginRequest req) {
        return ApiResponse.ok(authService.login(req.username, req.password));
    }

    @PostMapping("/refresh")
    public ApiResponse<Map<String, Object>> refresh(@RequestBody Map<String, String> body) {
        return ApiResponse.ok(authService.refresh(body.get("refreshToken")));
    }

    @GetMapping("/me")
    public ApiResponse<WmsPrincipal> me(@AuthenticationPrincipal WmsPrincipal principal) {
        return ApiResponse.ok(principal);
    }

    @Getter @Setter
    static class LoginRequest {
        @NotBlank String username;
        @NotBlank String password;
    }
}
