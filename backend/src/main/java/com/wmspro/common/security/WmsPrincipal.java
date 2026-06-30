package com.wmspro.common.security;

import lombok.Getter;

import java.security.Principal;
import java.util.UUID;

@Getter
public class WmsPrincipal implements Principal {
    private final String id;
    private final String username;
    private final String role;

    public WmsPrincipal(String id, String username, String role) {
        this.id       = id;
        this.username = username;
        this.role     = role;
    }

    public UUID getUuid() {
        return UUID.fromString(id);
    }

    @Override
    public String getName() {
        return username;
    }
}
