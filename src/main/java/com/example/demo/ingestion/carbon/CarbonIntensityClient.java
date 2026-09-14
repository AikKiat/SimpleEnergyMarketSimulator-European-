package com.example.demo.ingestion.carbon;

import com.example.demo.ingestion.model.FuelShare;
import com.example.demo.ingestion.model.MarketData;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Fetches live GB market data from the Carbon Intensity API and maps it into our
 * domain model. Two endpoints, two different JSON shapes.
 *
 */
@Component
public class CarbonIntensityClient {

    private static final Logger log = LoggerFactory.getLogger(CarbonIntensityClient.class);
    private final RestClient restClient;
    private final Validator validator;

    public CarbonIntensityClient(RestClient carbonIntensityRestClient, Validator validator) {
        this.restClient = carbonIntensityRestClient;
        this.validator = validator;
    }

    /**
     * Calls GET /generation and GET /intensity, returning them as one snapshot.
     *
     * <p>The generation mix is mandatory: if it is missing or invalid the whole
     * poll fails and the projector keeps serving the last good reading.
     * Intensity is best-effort — a bad or absent intensity payload is logged and
     * the mix is still published.
     */
    public MarketData fetchCurrentMarketData() {
        CarbonIntensityResponse response = restClient.get()
                .uri("/generation")
                .retrieve()
                .body(CarbonIntensityResponse.class);

        if (response == null) {
            throw new IllegalStateException("Carbon Intensity API returned an empty body for /generation");
        }
        requireValid(response, "/generation");

        CarbonIntensityResponse.Data data = response.data();
        List<FuelShare> mix = data.generationmix().stream()
                .map(e -> new FuelShare(e.fuel(), e.perc()))
                .sorted(Comparator.comparingDouble(FuelShare::perc).reversed())
                .toList();

        Integer grams = null;
        String index = null;
        try {
            CarbonIntensityResponse.IntensityResponse intensity = restClient.get()
                    .uri("/intensity")
                    .retrieve()
                    .body(CarbonIntensityResponse.IntensityResponse.class);

            if (intensity != null) {
                requireValid(intensity, "/intensity");
                CarbonIntensityResponse.IntensityResponse.Intensity reading = intensity.data().get(0).intensity();
                // 'actual' stays null until the settlement period closes.
                grams = reading.actual() != null ? reading.actual() : reading.forecast();
                index = reading.index();
            }
        } catch (Exception e) {
            log.warn("Carbon intensity fetch failed (generation mix still OK): {}", e.getMessage());
        }

        return new MarketData(data.from(), data.to(), mix, grams, index);
    }

    /**
     * Fails fast with every violation named, e.g.
     * {@code data.generationmix[3].perc: must be less than or equal to 100.0}.
     * Sorted so the log line is stable and easy to compare between polls.
     */
    private <T> void requireValid(T payload, String endpoint) {
        Set<ConstraintViolation<T>> violations = validator.validate(payload);
        if (violations.isEmpty()) {
            return;
        }
        String detail = violations.stream()
                .map(v -> v.getPropertyPath() + ": " + v.getMessage())
                .sorted()
                .collect(Collectors.joining("; "));
        throw new IllegalStateException(
                "Carbon Intensity API " + endpoint + " payload failed validation — " + detail);
    }
}
