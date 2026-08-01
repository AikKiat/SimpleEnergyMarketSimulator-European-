package com.example.demo.ingestion.carbon;

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
 *  the cleaner {@code MarketData} domain record instead. */
public record CarbonIntensityResponse(Data data) {

    public record Data(String from, String to, List<Entry> generationmix) {
    }

    public record Entry(String fuel, double perc) {
    }

    //Separate shape for /intensity, whose {@code data} is a list.
    public record IntensityResponse(List<IntensityData> data) {

        public record IntensityData(String from, String to, Intensity intensity) {
        }

        //{@code actual} is null until the settlement period has completed, so callers fall back to {@code forecast}. */
        public record Intensity(Integer forecast, Integer actual, String index) {
        }
    }
}
