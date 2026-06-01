package com.wmspro.common.security;

import lombok.Getter;

@Getter
public class WmsPrincipal {
    private final String id;
    private final String username;
    private final String role;

    public WmsPrincipal(String id, String username, String role) {
        this.id       = id;
        this.username = username;
        this.role     = role;
    }
}
