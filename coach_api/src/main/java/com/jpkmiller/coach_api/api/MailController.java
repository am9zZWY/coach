package com.jpkmiller.coach_api.api;

import com.jpkmiller.coach_api.core.Mail;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("mail")
public class MailController {

    MailConsumer mailConsumer;

    public MailController(MailConsumer mailConsumer) {
        this.mailConsumer = mailConsumer;
    }

    @GetMapping("")
    List<Mail> mail() {
        return mailConsumer.mails;
    }

    @GetMapping("/counter")
    long counter() {
        return mailConsumer.mails.stream().map(Mail::from).distinct().count();
    }
}
