package com.example.demo.insight;

import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

import com.example.demo.kafka.topics.Topics;

// @RestController
// @RequestMapping("/api/insight")
public class InsightController {

    public record AskRequest(
            String sessionId,
            String eventType,
            String severity,
            String headline,
            String detail,
            String payloadJson,
            String fleetJson) {
    }

    public record Accepted(String id, String status) {
    }

    public record View(String status, Insight insight, String error) {
    }

    private final InsightRepository repository;
    private final KafkaTemplate<Object, Object> kafka;

    public InsightController(InsightRepository repository, KafkaTemplate<Object, Object> kafka) {
        this.repository = repository;
        this.kafka = kafka;
    }

    //Queue a question. Returns immediately id to poll.
    @PostMapping
    public Accepted ask(@RequestBody AskRequest request) {
        String id = UUID.randomUUID().toString();
        String sessionId = request.sessionId() == null || request.sessionId().isBlank()
                ? "anonymous"
                : request.sessionId();

        repository.save(new InsightRecord(id, sessionId, request.eventType(), request.headline()));

        kafka.send(Topics.INSIGHT_REQUESTS, id, new InsightJob(
                id, sessionId, request.eventType(), request.severity(),
                request.headline(), request.detail(), request.payloadJson(), request.fleetJson()));

        return new Accepted(id, InsightRecord.Status.PENDING.name());
    }


    @GetMapping("/{id}")
    public ResponseEntity<View> get(@PathVariable String id) {
        return repository.findById(id)
                .map(record -> ResponseEntity.ok(new View(
                        record.getStatus().name(),
                        record.getStatus() == InsightRecord.Status.READY ? record.toInsight() : null,
                        record.getError())))
                .orElse(ResponseEntity.notFound().build());
    }
}