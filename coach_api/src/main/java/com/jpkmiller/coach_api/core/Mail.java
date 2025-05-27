package com.jpkmiller.coach_api.core;

public record Mail(String from, String subject, String message, String id, long receivedAt) {
}
