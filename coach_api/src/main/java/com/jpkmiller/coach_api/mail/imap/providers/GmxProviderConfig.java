package com.jpkmiller.coach_api.mail.imap.providers;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

@Configuration
public class GmxProviderConfig extends MailProviderConfig {

    public GmxProviderConfig(
            @Value("${mail.gmx.username}") String username,
            @Value("${mail.gmx.password}") String password) {
        super("imap.gmx.net", "993", username, password, "GMX");
    }
}
