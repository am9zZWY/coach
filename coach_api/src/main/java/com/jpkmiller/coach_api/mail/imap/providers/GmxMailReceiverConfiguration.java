package com.jpkmiller.coach_api.mail.imap.providers;

import com.jpkmiller.coach_api.mail.producer.MailServiceProducer;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.integration.annotation.InboundChannelAdapter;
import org.springframework.integration.annotation.Poller;
import org.springframework.integration.annotation.ServiceActivator;
import org.springframework.integration.channel.DirectChannel;
import org.springframework.integration.mail.ImapMailReceiver;
import org.springframework.integration.mail.MailReceiver;
import org.springframework.integration.mail.MailReceivingMessageSource;
import org.springframework.messaging.Message;

import java.util.Properties;

@Configuration
@ConditionalOnProperty(name = "mail.gmx.enabled", havingValue = "true", matchIfMissing = true)
public class GmxMailReceiverConfiguration {

    private static final Logger log = LoggerFactory.getLogger(GmxMailReceiverConfiguration.class);

    private final MailServiceProducer mailServiceProducer;
    private final GmxProviderConfig gmxProviderConfig;

    public GmxMailReceiverConfiguration(MailServiceProducer mailServiceProducer, GmxProviderConfig gmxProviderConfig) {
        this.mailServiceProducer = mailServiceProducer;
        this.gmxProviderConfig = gmxProviderConfig;
        log.info("Initializing GMX Mail Receiver Configuration");
    }

    @ServiceActivator(inputChannel = "gmxEmailChannel")
    public void receiveGmxEmail(Message<?> message) {
        log.info("Received GMX email");
        mailServiceProducer.handleReceivedMail((MimeMessage) message.getPayload());
    }

    @Bean("gmxEmailChannel")
    public DirectChannel gmxEmailChannel() {
        DirectChannel directChannel = new DirectChannel();
        directChannel.setDatatypes(MimeMessage.class);
        return directChannel;
    }

    @Bean("gmxMailMessageSource")
    @InboundChannelAdapter(channel = "gmxEmailChannel", poller = @Poller(fixedDelay = "30000", taskExecutor = "asyncTaskExecutor"))
    public MailReceivingMessageSource gmxMailMessageSource() {
        return new MailReceivingMessageSource(gmxImapMailReceiver());
    }

    @Bean("gmxImapMailReceiver")
    public MailReceiver gmxImapMailReceiver() {
        var storeUrl = gmxProviderConfig.getStoreUrl();
        log.info("GMX IMAP connection url: {}", storeUrl.replaceAll(":[^:]*@", ":***@"));

        ImapMailReceiver imapMailReceiver = new ImapMailReceiver(storeUrl);
        imapMailReceiver.setShouldMarkMessagesAsRead(false);
        imapMailReceiver.setShouldDeleteMessages(false);
        imapMailReceiver.setMaxFetchSize(10);
        imapMailReceiver.setAutoCloseFolder(true);

        // Only fetch unseen messages
        imapMailReceiver.setSearchTermStrategy((supportedTerms, folder) -> {
            if (supportedTerms.contains("UNSEEN")) {
                return new jakarta.mail.search.FlagTerm(new jakarta.mail.Flags(jakarta.mail.Flags.Flag.SEEN), false);
            }
            return null;
        });

        Properties javaMailProperties = new Properties();
        javaMailProperties.put("mail.store.protocol", "imaps");
        javaMailProperties.put("mail.imaps.host", "imap.gmx.net");
        javaMailProperties.put("mail.imaps.port", "993");
        javaMailProperties.put("mail.imaps.ssl.enable", "true");
        javaMailProperties.put("mail.imaps.ssl.trust", "*");
        javaMailProperties.put("mail.imaps.timeout", "10000");
        javaMailProperties.put("mail.imaps.connectiontimeout", "10000");
        javaMailProperties.put("mail.debug", "false"); // Set to true for debugging

        imapMailReceiver.setJavaMailProperties(javaMailProperties);
        return imapMailReceiver;
    }
}
