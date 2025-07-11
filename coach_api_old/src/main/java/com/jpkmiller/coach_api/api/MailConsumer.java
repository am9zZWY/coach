package com.jpkmiller.coach_api.api;

import com.jpkmiller.coach_api.core.Mail;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Component
public class MailConsumer {
    List<Mail> mails = new ArrayList<>();

    @KafkaListener(topics = "mail", groupId = "my-group-id")
    public void listen(Mail mail) {
        mails.add(mail);
    }
}
