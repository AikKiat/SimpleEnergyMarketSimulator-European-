package com.example.demo.ingestion.carbon;

import com.example.demo.ingestion.model.FuelShare;
import com.example.demo.ingestion.model.MarketData;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.Comparator;
import java.util.List;

/**
 * Fetches live GB market data from the Carbon Intensity API and maps it into our
 * domain model. Two endpoints, two different JSON shapes.
 *
 */
@Component
public class CarbonIntensityClient {

    private static final Logger log = LoggerFactory.getLogger(CarbonIntensityClient.class);
    private final RestClient restClient;

    public CarbonIntensityClient(RestClient carbonIntensityRestClient) {
        this.restClient = carbonIntensityRestClient;
    }

    /**
     * Calls GET /generation and GET /intensity, returning them as one snapshot.
     *
     */
    public MarketData fetchCurrentMarketData() {
        CarbonIntensityResponse response = restClient.get()
                .uri("/generation")
                .retrieve()
                .body(CarbonIntensityResponse.class);

        if (response == null || response.data() == null) {
            throw new IllegalStateException("Carbon Intensity API returned no generation data");
        }

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

            if (intensity != null && intensity.data() != null && !intensity.data().isEmpty()) {
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
}
