package com.jpkmiller.coach_api.mail.imap.providers;

import java.util.Objects;

record ImapConfig(String host, String port, String username, String password) {

    public ImapConfig {
        // Validation logic allowed in compact constructor (Java 16+)
        Objects.requireNonNull(host, "host cannot be null");
        if (host.isBlank()) throw new IllegalArgumentException("host cannot be blank");
        Objects.requireNonNull(port, "port cannot be null");
        if (port.isBlank()) throw new IllegalArgumentException("port cannot be blank");
        if (Integer.parseInt(port) > 65535) throw new IllegalArgumentException("port cannot be greater than 65535");
        Objects.requireNonNull(username, "username cannot be null");
        if (username.isBlank()) throw new IllegalArgumentException("username cannot be blank");
        Objects.requireNonNull(password, "password cannot be null");
        if (password.isBlank()) throw new IllegalArgumentException("password cannot be empty");
    }

    @Override
    public String toString() {
        return "ImapConfig[" +
                "host='" + host + '\'' +
                ", port=" + port +
                ", username='" + username + '\'' +
                ", password=[PROTECTED]" +
                ']';
    }
}
