package com.wmspro.domain.auth;

import com.wmspro.common.exception.BusinessException;
import com.wmspro.common.exception.ErrorCode;
import com.wmspro.common.security.JwtTokenProvider;
import com.wmspro.domain.user.User;
import com.wmspro.domain.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository   userRepo;
    private final PasswordEncoder  passwordEncoder;
    private final JwtTokenProvider tokenProvider;

    @Transactional
    public Map<String, Object> login(String username, String password) {
        User user = userRepo.findByUsernameOrEmail(username)
            .orElseThrow(() -> new BusinessException(ErrorCode.INVALID_CREDENTIALS));

        if (!user.isActive()) throw new BusinessException(ErrorCode.INVALID_CREDENTIALS);
        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new BusinessException(ErrorCode.INVALID_CREDENTIALS);
        }

        userRepo.updateLastLogin(user.getId(), Instant.now());

        String idStr   = user.getId().toString();
        String roleStr = user.getRole().name();

        return Map.of(
            "accessToken",  tokenProvider.generateAccessToken(idStr, user.getUsername(), roleStr),
            "refreshToken", tokenProvider.generateRefreshToken(idStr, user.getUsername(), roleStr),
            "user", Map.of(
                "id",          idStr,
                "username",    user.getUsername(),
                "fullName",    user.getFullName(),
                "role",        roleStr,
                "warehouseId", user.getWarehouseId() != null ? user.getWarehouseId().toString() : ""
            )
        );
    }

    public Map<String, Object> refresh(String refreshToken) {
        if (!tokenProvider.validate(refreshToken)) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        String userId   = tokenProvider.getUserId(refreshToken);
        String username = tokenProvider.getUsername(refreshToken);
        String role     = tokenProvider.getRole(refreshToken);

        return Map.of(
            "accessToken",  tokenProvider.generateAccessToken(userId, username, role),
            "refreshToken", tokenProvider.generateRefreshToken(userId, username, role)
        );
    }
}
