package com.example.demo.ingestion.model;

import java.util.List;

/**
 * One poll of live GB market data — the domain event published to Kafka.
 *
 * <p>This is what the backend actually knows about the real world. It is
 * deliberately data only: no marginal costs, no dispatch decisions, no plants.
 * The frontend owns the model; this pipeline owns the measurements.
 *
 * @param carbonIntensityGramsPerKwh gCO2 per kWh of electricity generated right
 *        now. Note this is an <b>intensity</b>, not the EU ETS carbon
 *        <b>price</b> — different quantities, never to be conflated.
 */
public record MarketData(
        String from,
        String to,
        List<FuelShare> mix,
        Integer carbonIntensityGramsPerKwh,
        String carbonIntensityIndex) {
}
