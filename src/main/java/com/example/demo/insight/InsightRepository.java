package com.example.demo.insight;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface InsightRepository extends JpaRepository<InsightRecord, String> {

    /**
     * The analyst's memory: what it has already explained in this session,
     * newest first. Fed back into the prompt so it builds on prior answers
     * instead of re-explaining the same mechanism every time.
     */
    List<InsightRecord> findTop8BySessionIdAndStatusOrderByCreatedAtDesc(
            String sessionId, InsightRecord.Status status);
}
