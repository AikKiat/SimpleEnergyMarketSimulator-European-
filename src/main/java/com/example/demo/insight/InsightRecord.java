package com.example.demo.insight;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * A single analyst answer, persisted.
 *
**/


@Entity
@Table(name = "insight")
public class InsightRecord {

    public enum Status { PENDING, READY, FAILED }

    @Id
    private String id;

    @Column(nullable = false)
    private String sessionId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status;

    private String eventType;

    @Column(length = 500)
    private String eventHeadline;

    @Column(length = 500)
    private String headline;

    @Column(length = 2000)
    private String why;

    @Column(length = 2000)
    private String watchNext;

    @Column(length = 2000)
    private String action;

    @Column(length = 1000)
    private String error;

    @Column(nullable = false)
    private Instant createdAt;

    protected InsightRecord() {
    }

    public InsightRecord(String id, String sessionId, String eventType, String eventHeadline) {
        this.id = id;
        this.sessionId = sessionId;
        this.eventType = eventType;
        this.eventHeadline = eventHeadline;
        this.status = Status.PENDING;
        this.createdAt = Instant.now();
    }

    public void complete(Insight insight) {
        this.headline = insight.headline();
        this.why = insight.why();
        this.watchNext = insight.watchNext();
        this.action = insight.action();
        this.status = Status.READY;
    }

    public void fail(String message) {
        this.error = message != null && message.length() > 990 ? message.substring(0, 990) : message;
        this.status = Status.FAILED;
    }

    public Insight toInsight() {
        return new Insight(headline, why, watchNext, action);
    }

    public String getId() {
        return id;
    }

    public String getSessionId() {
        return sessionId;
    }

    public Status getStatus() {
        return status;
    }

    public String getEventType() {
        return eventType;
    }

    public String getEventHeadline() {
        return eventHeadline;
    }

    public String getHeadline() {
        return headline;
    }

    public String getError() {
        return error;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
