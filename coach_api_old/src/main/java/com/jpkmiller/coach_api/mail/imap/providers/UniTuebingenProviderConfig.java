package com.jpkmiller.coach_api.mail.imap.providers;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

@Configuration
public class UniTuebingenProviderConfig extends MailProviderConfig {

    public UniTuebingenProviderConfig(
            @Value("${mail.uni-tuebingen.username}") String username,
            @Value("${mail.uni-tuebingen.password}") String password) {
        super("mailserv.uni-tuebingen.de", "993", username, password, "UniTuebingen");
    }
}
