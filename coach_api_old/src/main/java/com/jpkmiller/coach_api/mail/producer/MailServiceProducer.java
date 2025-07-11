package com.jpkmiller.coach_api.mail.producer;

import com.jpkmiller.coach_api.core.Mail;
import jakarta.mail.internet.MimeMessage;
import org.apache.commons.mail2.jakarta.util.MimeMessageParser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class MailServiceProducer {

    private static final Logger log = LoggerFactory.getLogger(MailServiceProducer.class);

    private final KafkaTemplate<String, Mail> kafkaTemplate;

    @Autowired
    public MailServiceProducer(KafkaTemplate<String, Mail> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    public void handleReceivedMail(MimeMessage receivedMessage) {
        try {
            log.info("Processing received email message");

            final MimeMessageParser parser = new MimeMessageParser(receivedMessage).parse();

            String from = parser.getFrom();
            String subject = parser.getSubject();
            String content = parser.getPlainContent();
            long receivedAt = receivedMessage.getReceivedDate().getTime();

            log.info("Email from: {}, Subject: {}", from, subject);

            if (from == null || from.trim().isEmpty()) {
                log.warn("Email from address is null or empty, skipping");
                return;
            }

            var mail = new Mail(
                    from,
                    subject != null ? subject : "",
                    content != null ? content : "",
                    UUID.randomUUID().toString(),
                    receivedAt
            );

            kafkaTemplate.send("mail", mail)
                    .whenComplete((result, ex) -> {
                        if (ex == null) {
                            log.info("Successfully sent email to Kafka: {}", subject);
                        } else {
                            log.error("Failed to send email to Kafka: {}", ex.getMessage());
                        }
                    });

        } catch (Exception e) {
            log.error("Error processing received email");
        }
    }
}
