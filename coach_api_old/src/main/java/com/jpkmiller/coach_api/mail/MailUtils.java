package com.jpkmiller.coach_api.mail;

public class MailUtils {

    private MailUtils() {
    }

    public static boolean checkEmailFormat(String email) {
        return email.matches("[^@]+@([\\w\\-+]\\.?)+\\.[a-zA-Z]+");
    }
}
