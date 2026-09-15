package com.example.demo.ingestion.domain_contract;

import java.util.Objects;

/**
 * One fuel's share of the current generation mix, e.g. gas at 38.4%.
 *
 */
public record FuelShare(String fuel, double perc) {

    public FuelShare {
        Objects.requireNonNull(fuel, "fuel must not be null");
        if (fuel.isBlank()) {
            throw new IllegalArgumentException("fuel must not be blank");
        }
        if (Double.isNaN(perc) || perc < 0.0 || perc > 100.0) {
            throw new IllegalArgumentException("perc must be within 0..100, got " + perc + " for fuel '" + fuel + "'");
        }
    }
}
