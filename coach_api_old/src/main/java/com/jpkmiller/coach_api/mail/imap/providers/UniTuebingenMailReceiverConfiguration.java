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
@ConditionalOnProperty(name = "mail.uni-tuebingen.enabled", havingValue = "true", matchIfMissing = true)
public class UniTuebingenMailReceiverConfiguration {

    private static final Logger log = LoggerFactory.getLogger(UniTuebingenMailReceiverConfiguration.class);

    private final MailServiceProducer mailServiceProducer;
    private final UniTuebingenProviderConfig uniTuebingenProviderConfig;

    public UniTuebingenMailReceiverConfiguration(MailServiceProducer mailServiceProducer, UniTuebingenProviderConfig uniTuebingenProviderConfig) {
        this.mailServiceProducer = mailServiceProducer;
        this.uniTuebingenProviderConfig = uniTuebingenProviderConfig;
        log.info("Initializing Uni Tübingen Mail Receiver Configuration");
    }

    @ServiceActivator(inputChannel = "uniTuebingenEmailChannel")
    public void receiveUniTuebingenEmail(Message<?> message) {
        log.info("Received Uni Tübingen email");
        mailServiceProducer.handleReceivedMail((MimeMessage) message.getPayload());
    }

    @Bean("uniTuebingenEmailChannel")
    public DirectChannel uniTuebingenEmailChannel() {
        DirectChannel directChannel = new DirectChannel();
        directChannel.setDatatypes(MimeMessage.class);
        return directChannel;
    }

    @Bean("uniTuebingenMailMessageSource")
    @InboundChannelAdapter(channel = "uniTuebingenEmailChannel", poller = @Poller(fixedDelay = "30000", taskExecutor = "asyncTaskExecutor"))
    public MailReceivingMessageSource uniTuebingenMailMessageSource() {
        return new MailReceivingMessageSource(uniTuebingenImapMailReceiver());
    }

    @Bean("uniTuebingenImapMailReceiver")
    public MailReceiver uniTuebingenImapMailReceiver() {
        var storeUrl = uniTuebingenProviderConfig.getStoreUrl();
        log.info("Uni Tübingen IMAP connection url: {}", storeUrl.replaceAll(":[^:]*@", ":***@"));

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
        javaMailProperties.put("mail.imaps.host", "mailserv.uni-tuebingen.de");
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
