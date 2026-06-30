package com.wmspro.common.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Slf4j
@Component
public class JwtTokenProvider {

    private final SecretKey key;
    private final long      expiration;
    private final long      refreshExpiration;

    public JwtTokenProvider(
        @Value("${jwt.secret}")              String secret,
        @Value("${jwt.expiration}")          long   expiration,
        @Value("${jwt.refresh-expiration}")  long   refreshExpiration
    ) {
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < 32) {
            // HMAC-SHA256은 최소 256비트(32바이트) 키 필요
            // 생성: openssl rand -hex 32
            throw new IllegalStateException(
                "JWT_SECRET must be at least 32 bytes. Generate one with: openssl rand -hex 32");
        }
        this.key              = Keys.hmacShaKeyFor(keyBytes);
        this.expiration       = expiration * 1000L;
        this.refreshExpiration = refreshExpiration * 1000L;
    }

    public String generateAccessToken(String userId, String username, String role) {
        return buildToken(userId, username, role, expiration);
    }

    public String generateRefreshToken(String userId, String username, String role) {
        return buildToken(userId, username, role, refreshExpiration);
    }

    private String buildToken(String userId, String username, String role, long exp) {
        Date now = new Date();
        return Jwts.builder()
            .subject(userId)
            .claim("username", username)
            .claim("role", role)
            .issuedAt(now)
            .expiration(new Date(now.getTime() + exp))
            .signWith(key)
            .compact();
    }

    public Claims parseClaims(String token) {
        return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
    }

    public boolean validate(String token) {
        try {
            parseClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            log.warn("Invalid JWT: {}", e.getMessage());
            return false;
        }
    }

    public String getUserId(String token)   { return parseClaims(token).getSubject(); }
    public String getUsername(String token) { return parseClaims(token).get("username", String.class); }
    public String getRole(String token)     { return parseClaims(token).get("role", String.class); }
}
