package com.example.demo.ingestion.carbon;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

/** Maps the JSON returned by the Carbon Intensity API.
 *
 *  <p>{@code GET /generation} returns a single object:
 *  <pre>{ "data": { "from": ..., "to": ..., "generationmix": [ {fuel, perc} ] } }</pre>
 *
 *  <p>{@code GET /intensity} returns a one-element ARRAY instead — a different
 *  shape, hence the second record below:
 *  <pre>{ "data": [ { "from": ..., "to": ..., "intensity": {forecast, actual, index} } ] }</pre>
 *
 *  These types exist only to deserialize the wire format; the app works with
 *  the cleaner {@code MarketData} domain record instead.
 *
 *  <p>The constraint annotations are Jakarta Bean Validation - Java's equivalent
 *  of a zod or pydantic schema. Jackson alone will accept anything, so we need Jakarta Bean validation, from SpringBoot Starter Validation;
 */
public record CarbonIntensityResponse(@NotNull @Valid Data data) {

    public record Data(
            @NotBlank String from,
            @NotBlank String to,
            @NotEmpty List<@Valid Entry> generationmix) {
    }

    public record Entry(
            @NotBlank String fuel,
            @DecimalMin("0.0") @DecimalMax("100.0") double perc) {
    }

    //Separate shape for /intensity, whose {@code data} is a list.
    public record IntensityResponse(@NotEmpty List<@Valid IntensityData> data) {

        public record IntensityData(
                @NotBlank String from,
                @NotBlank String to,
                @NotNull @Valid Intensity intensity) {
        }

        //{@code actual} is null until the settlement period has completed, so callers fall back to {@code forecast}. */
        public record Intensity(Integer forecast, Integer actual, String index) {
        }
    }
}
