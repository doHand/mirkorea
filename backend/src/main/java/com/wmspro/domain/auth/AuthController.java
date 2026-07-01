package com.wmspro.domain.auth;

import com.wmspro.common.ApiResponse;
import com.wmspro.common.exception.BusinessException;
import com.wmspro.common.exception.ErrorCode;
import com.wmspro.common.security.WmsPrincipal;
import com.wmspro.domain.user.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.Setter;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService    authService;
    private final UserRepository userRepo;

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Void> register(@Valid @RequestBody RegisterRequest req) {
        authService.register(req.username, req.email, req.fullName, req.phone,
                             req.password, req.securityQuestion, req.securityAnswer);
        return ApiResponse.ok(null, "회원가입이 완료되었습니다");
    }

    @GetMapping("/security-question")
    public ApiResponse<String> securityQuestion(@RequestParam String username) {
        return ApiResponse.ok(authService.getSecurityQuestion(username));
    }

    @PostMapping("/reset-password-by-answer")
    public ApiResponse<Void> resetPasswordByAnswer(@Valid @RequestBody ResetByAnswerRequest req) {
        authService.resetPasswordByAnswer(req.username, req.answer, req.newPassword);
        return ApiResponse.ok(null, "비밀번호가 재설정되었습니다");
    }

    @PostMapping("/login")
    public ApiResponse<Map<String, Object>> login(@Valid @RequestBody LoginRequest req) {
        return ApiResponse.ok(authService.login(req.username, req.password));
    }

    @PostMapping("/refresh")
    public ApiResponse<Map<String, Object>> refresh(@RequestBody Map<String, String> body) {
        String refreshToken = body.get("refreshToken");
        if (refreshToken == null || refreshToken.isBlank())
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        return ApiResponse.ok(authService.refresh(refreshToken));
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

    @Getter @Setter
    static class RegisterRequest {
        @NotBlank String username;
        @NotBlank @Email String email;
        @NotBlank String fullName;
        String phone;
        @NotBlank
        @Pattern(regexp = "^(?=.*[a-zA-Z])(?=.*\\d).{8,}$", message = "비밀번호는 영문·숫자 포함 8자 이상이어야 합니다")
        String password;
        @NotBlank String securityQuestion;
        @NotBlank String securityAnswer;
    }

    @Getter @Setter
    static class ResetByAnswerRequest {
        @NotBlank String username;
        @NotBlank String answer;
        @NotBlank
        @Pattern(regexp = "^(?=.*[a-zA-Z])(?=.*\\d).{8,}$", message = "비밀번호는 영문·숫자 포함 8자 이상이어야 합니다")
        String newPassword;
    }
}
