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
        if (!ALLOWED_SECURITY_QUESTIONS.contains(req.securityQuestion)) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST);
        }
        authService.register(req.username, req.email, req.fullName, req.phone,
                             req.password, req.securityQuestion, req.securityAnswer);
        return ApiResponse.ok(null, "회원가입이 완료되었습니다");
    }

    @GetMapping("/security-question")
    public ApiResponse<String> securityQuestion(@RequestParam String username) {
        // 사용자 존재 여부를 노출하지 않기 위해 없는 경우에도 동일한 응답 반환
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

    static final java.util.Set<String> ALLOWED_SECURITY_QUESTIONS = java.util.Set.of(
        "어머니 성함은?", "초등학교 이름은?", "첫 번째 반려동물 이름은?",
        "태어난 도시는?", "가장 좋아하는 음식은?", "졸업한 고등학교 이름은?"
    );

    @Getter @Setter
    static class RegisterRequest {
        @NotBlank
        @Pattern(regexp = "^[a-zA-Z0-9_]{4,50}$", message = "아이디는 영문·숫자·밑줄 4~50자여야 합니다")
        String username;
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
