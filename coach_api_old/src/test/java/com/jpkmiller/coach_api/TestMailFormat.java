package com.jpkmiller.coach_api;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.jpkmiller.coach_api.mail.MailUtils;
import org.junit.jupiter.api.Test;

class TestMailFormat {

    @Test
    void testEmailFormat() {
        assertFalse(MailUtils.checkEmailFormat("josef.pk.mueller@@uni-utbien.de"));
        assertFalse(MailUtils.checkEmailFormat("josef.pk.mueller@uni-utbien,de"));
        assertFalse(MailUtils.checkEmailFormat("de"));
        assertTrue(MailUtils.checkEmailFormat("josef.pk.mueller@gmx.de"));
    }
}
