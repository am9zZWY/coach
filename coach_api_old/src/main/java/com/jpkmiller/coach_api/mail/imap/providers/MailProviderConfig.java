package com.jpkmiller.coach_api.mail.imap.providers;

import lombok.Getter;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

public abstract class MailProviderConfig {
    final ImapConfig config;

    @Getter
    final String name;

    MailProviderConfig(String host, String port, String username, String password, String name) {
        this.name = name;
        this.config = new ImapConfig(host, port, username, password);
    }

    public String getStoreUrl() {
        try {
            String encodedUsername = URLEncoder.encode(config.username(), StandardCharsets.UTF_8);
            String encodedPassword = URLEncoder.encode(config.password(), StandardCharsets.UTF_8);
            return "imaps://" + encodedUsername + ":" + encodedPassword + "@" + config.host() + ":" + config.port() + "/INBOX";
        } catch (Exception e) {
            return "imaps://" + config.username() + ":" + config.password() + "@" + config.host() + ":" + config.port() + "/INBOX";
        }
    }

    public String getHost() {
        return config.host();
    }

    public String getPort() {
        return config.port();
    }
}
