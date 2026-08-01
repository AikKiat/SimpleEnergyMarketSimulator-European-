package com.example.demo.insight;

/**
 * One "explain this event" request, as it traver over Kafka and dispatched.
**/
public record InsightJob(
        String id, 
        String sessionId, //Per-browser-session id — the key the analyst's memory is scoped to
        String eventType,
        String severity,
        String headline,
        String detail,
        String payloadJson,
        String fleetJson) {
}
