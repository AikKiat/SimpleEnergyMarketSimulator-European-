package com.example.demo.insight;

import java.util.List;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.transaction.annotation.Transactional;

import com.anthropic.models.messages.CacheControlEphemeral;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.StructuredMessageCreateParams;
import com.anthropic.models.messages.TextBlockParam;
import com.example.demo.kafka.topics.Topics;

/**
 * The trading-desk analyst.
 *
 * <p>Consumes "explain this event" jobs off Kafka, asks Claude, and stores the
 * answer for the browser to collect. Runs off the request thread entirely, so a
 * slow model call never blocks the UI.
 *
 * <p>Two design points worth knowing:
 *
 * <ul>
 *   <li><b>Prompt caching.</b> The system prompt below is long and never
 *       changes, and every request in the app shares it. Marking it with
 *       {@code cache_control} means repeat calls read that prefix at roughly a
 *       tenth of the input cost. Keep it free of timestamps and per-request
 *       values or the cache silently stops matching.
 *   <li><b>Memory.</b> Before answering, we read back what this session has
 *       already been told (from Postgres) and pass it along, so the analyst
 *       builds on earlier answers instead of re-explaining the merit order
 *       every single time.
 * </ul>
 */

// @Service
public class InsightService {

    private static final Logger log = LoggerFactory.getLogger(InsightService.class);

    private static final String MODEL = "claude-opus-5";
    private static final long MAX_TOKENS = 2000L;

    /**
     * Stable, cacheable prefix. Nothing per-request may appear in here.
     */
    private static final String SYSTEM_PROMPT = """
            You are a power-trading desk analyst embedded in a simulated European
            electricity market. A monitoring console detects market events and you
            explain them to the operator, the way a senior analyst would brief a
            colleague on the desk.

            ## The market you are working in

            Plants are dispatched by merit order. Each plant has a marginal cost:

                marginalCost = (fuelPrice / efficiency) + (co2PerMwh * carbonPrice)

            The spark spread is the power price minus that marginal cost. A plant
            runs when its spread is positive and stops when it is negative. Fixed
            and capital costs are sunk and never enter a dispatch decision.

            In auction mode the price is not an input: offers are stacked cheapest
            first, demand is filled from the bottom, and the last plant required —
            the marginal plant — sets a single clearing price paid to everyone who
            cleared. Cheap plants therefore earn margin, not just volume.

            Other mechanics you may need:
            - A plant may offer above its marginal cost. If it still clears it
              captures extra margin; if it does not clear it earns nothing at all.
            - Subsidised renewables can rationally offer below zero, which is how
              clearing prices go negative.
            - Raising the carbon price hurts high-emitting plants disproportionately
              and can reorder the stack — coal-to-gas switching.
            - A flexible peaking plant earns from volatility, not throughput. Running
              rarely is not the same as being unprofitable.
            - Forward contracts fix revenue on the contracted volume, so only the
              difference between output and contracted volume is exposed to spot.

            ## How to answer

            You receive one detected event, the full fleet state, and a note of what
            you have already explained in this session.

            Return exactly four fields:

            - headline: one short sentence stating what happened and why it matters.
              No preamble, no restating the event verbatim.
            - why: the economics behind it, in two or three sentences. Refer to the
              actual numbers you were given — name the plants, quote the costs and
              spreads. Be specific rather than general.
            - watchNext: the single most informative thing to watch now, and what it
              would tell the operator. One or two sentences.
            - action: what a desk would consider doing, or explicitly why no action
              is warranted. One or two sentences.

            Style: direct, numerate, and concrete. Use the domain vocabulary
            (marginal plant, clearing price, spark spread, merit order, imbalance)
            because the operator is learning it. Never invent numbers that were not
            in the data you were given. If the event is routine, say so plainly
            rather than inflating it. Do not repeat an explanation the operator has
            already been given — build on it instead.
            """;

    private final AnthropicClientHolder anthropic;
    private final InsightRepository repository;

    public InsightService(AnthropicClientHolder anthropic, InsightRepository repository) {
        this.anthropic = anthropic;
        this.repository = repository;
    }

    // Its own consumer group — see the note in MarketProjector on why listeners
    // on different topics must not share one.
    @KafkaListener(topics = Topics.INSIGHT_REQUESTS, groupId = "${spring.kafka.consumer.group-id}-insight")
    @Transactional
    public void onJob(InsightJob job) {
        InsightRecord record = repository.findById(job.id()).orElse(null);
        if (record == null) {
            log.warn("Insight job {} has no record; dropping", job.id());
            return;
        }

        if (!anthropic.available()) {
            record.fail("The analyst is not configured on this server (ANTHROPIC_API_KEY is unset).");
            repository.save(record);
            return;
        }

        try {
            Insight insight = ask(job);
            if (insight == null) {
                record.fail("The analyst returned an empty response.");
            } else {
                record.complete(insight);
                log.info("Analyst answered {} for event {}", job.id(), job.eventType());
            }
        } catch (Exception e) {
            log.error("Analyst call failed for {}", job.id(), e);
            record.fail(e.getMessage());
        }
        repository.save(record);
    }

    private Insight ask(InsightJob job) {
        StructuredMessageCreateParams<Insight> params = MessageCreateParams.builder()
                .model(MODEL)
                .maxTokens(MAX_TOKENS)
                // Cache the long, unchanging briefing. The volatile part of the
                // request lives in the user message, after this breakpoint.
                .systemOfTextBlockParams(List.of(
                        TextBlockParam.builder()
                                .text(SYSTEM_PROMPT)
                                .cacheControl(CacheControlEphemeral.builder().build())
                                .build()))
                .outputConfig(Insight.class)
                .addUserMessage(userPrompt(job))
                .build();

        return anthropic.client().messages().create(params).content().stream()
                .flatMap(block -> block.text().stream())
                .map(typed -> typed.text())
                .findFirst()
                .orElse(null);
    }

    private String userPrompt(InsightJob job) {
        String memory = recentMemory(job.sessionId());
        return """
                DETECTED EVENT
                type: %s
                severity: %s
                headline: %s
                detail: %s
                payload: %s

                FLEET STATE
                %s

                ALREADY EXPLAINED THIS SESSION
                %s
                """.formatted(
                job.eventType(),
                job.severity(),
                job.headline(),
                job.detail(),
                job.payloadJson() == null ? "{}" : job.payloadJson(),
                job.fleetJson() == null ? "{}" : job.fleetJson(),
                memory);
    }

    /** The analyst's memory, straight out of Postgres. */
    private String recentMemory(String sessionId) {
        List<InsightRecord> prior = repository
                .findTop8BySessionIdAndStatusOrderByCreatedAtDesc(sessionId, InsightRecord.Status.READY);
        if (prior.isEmpty()) {
            return "(nothing yet — this is the first event you have explained to this operator)";
        }
        return prior.stream()
                .map(r -> "- [%s] %s".formatted(r.getEventType(), r.getHeadline()))
                .collect(Collectors.joining("\n"));
    }
}
