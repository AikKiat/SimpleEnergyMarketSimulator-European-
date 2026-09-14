package com.example.demo.ingestion.model;

import java.util.List;
import java.util.Objects;

/**
 * One poll of live GB market data — the domain event published to Kafka.
 *
 * <p>This is what the backend actually knows about the real world. It is
 * deliberately data only: no marginal costs, no dispatch decisions, no plants.
 * The frontend owns the model; this pipeline owns the measurements.
 *
 * <p>This record is the Kafka message schema.
 * mix ---> immutable list of already-validated {@link FuelShare}s, and the
 * intensity is non-negative.
 *
 * @param carbonIntensityGramsPerKwh
 */
public record MarketData(
        String from,
        String to,
        List<FuelShare> mix,
        Integer carbonIntensityGramsPerKwh,
        String carbonIntensityIndex) {

    public MarketData {
        Objects.requireNonNull(from, "from must not be null");
        Objects.requireNonNull(to, "to must not be null");
        if (from.isBlank() || to.isBlank()) {
            throw new IllegalArgumentException("settlement window (from/to) must not be blank");
        }
        // Defensive copy: the caller's list can be mutated later; ours cannot.
        // List.copyOf also rejects null elements, so every entry is a real FuelShare.
        mix = List.copyOf(Objects.requireNonNull(mix, "mix must not be null"));
        if (carbonIntensityGramsPerKwh != null && carbonIntensityGramsPerKwh < 0) {
            throw new IllegalArgumentException(
                    "carbonIntensityGramsPerKwh must not be negative, got " + carbonIntensityGramsPerKwh);
        }
    }
}
