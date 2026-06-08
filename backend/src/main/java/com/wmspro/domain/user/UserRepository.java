package com.wmspro.domain.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {

    @Query("SELECT u FROM User u WHERE u.username = :id OR u.email = :id")
    Optional<User> findByUsernameOrEmail(@Param("id") String usernameOrEmail);

    boolean existsByUsername(String username);
    boolean existsByEmail(String email);
    boolean existsByEmailIgnoreCase(String email);

    @Modifying
    @Query("UPDATE User u SET u.lastLoginAt = :at WHERE u.id = :id")
    void updateLastLogin(@Param("id") UUID id, @Param("at") Instant at);
}
