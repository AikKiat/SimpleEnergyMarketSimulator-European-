package com.example.demo.ingestion.model;

/** One fuel's share of the current generation mix, e.g. gas at 38.4%. */
public record FuelShare(String fuel, double perc) {
}
