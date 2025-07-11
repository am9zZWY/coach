package com.jpkmiller.coach_api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class CoachApiApplication {

    public static void main(String[] args) {
        SpringApplication.run(CoachApiApplication.class, args);
    }

}
