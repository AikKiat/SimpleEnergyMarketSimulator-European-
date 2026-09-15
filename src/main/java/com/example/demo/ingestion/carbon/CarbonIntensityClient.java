package com.example.demo.ingestion.carbon;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import com.example.demo.ingestion.domain_contract.FuelShare;
import com.example.demo.ingestion.domain_contract.MarketData;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;

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


    //RestClient carbonIntensityRestClient is injected into this class
    public CarbonIntensityClient(RestClient carbonIntensityRestClient, Validator validator) {
        this.restClient = carbonIntensityRestClient;
        this.validator = validator;
    }

    /*
     Calls GET /generation and GET /intensity, returningas one snapshot.
    */

    public MarketData fetchCurrentMarketData() {

        try{
            GenerationMix.Data data = fetch("/generation", GenerationMix.class).data();
            List<FuelShare> mix = data.generationmix().stream()
            .map(e -> new FuelShare(e.fuel(), e.perc()))
            .sorted(Comparator.comparingDouble(FuelShare::perc).reversed())
            .toList();

            requireUsableGenerationData(data, mix);
            
            Intensity intensityResponse = fetch("/intensity", Intensity.class);
            Intensity.IntensityData period = intensityResponse.data().getFirst();
            Intensity.Reading reading = period.intensity();

            requireUsableIntensity(reading);

            Integer grams = reading.actual() != null ? reading.actual() : reading.forecast();
            String index = reading.index();

            return new MarketData(data.from(), data.to(), mix, grams, index);

        } catch (Exception e){
            log.warn("[CARBON INTENSITY API REST CLIENT] Error in fetching generation mix or intensity from /generation and /intensity respecitvely: {}", e.getMessage()); 

            return null;
        }
    }


    private <T extends CarbonIntensityApi> T fetch(String endpoint, Class<T> type) {
        T body = restClient.get()
            .uri(endpoint)
            .retrieve()
            .body(type);

        if (body == null) {
            throw new IllegalStateException("[CARBON INTENSITY API REST CLIENT] Carbon Intensity API returned an empty body for " + endpoint);
        }
        
        requireValid(body, endpoint); //schema enforcement here
        
        return body;
    }


    private <T extends CarbonIntensityApi> void requireValid(T payload, String endpoint) {
        Set<ConstraintViolation<T>> violations = validator.validate(payload);
        if (violations.isEmpty()) {
            return;
        }
        
        String detail = violations.stream()
            .map(v -> v.getPropertyPath() + ": " + v.getMessage())
            .sorted()
            .collect(Collectors.joining("; "));
    
            throw new IllegalStateException("[CARBON INTENSITY API REST CLIENT] Carbon Intensity API " + endpoint + " payload failed validation - " + detail);
    }


    private void requireUsableGenerationData(
        GenerationMix.Data data,
        List<FuelShare> mix) {

        List<String> problems = new ArrayList<>();

        if (data.from() == null || data.from().isBlank()) {
            problems.add("from is missing");
        }

        if (data.to() == null || data.to().isBlank()) {
            problems.add("to is missing");
        }

        if (mix.isEmpty()) {
            problems.add("generation mix is empty");
        }

        double totalPercentage = mix.stream()
                .mapToDouble(FuelShare::perc)
                .sum();

        if (Math.abs(totalPercentage - 100.0) > 1.0) {
            problems.add("generation shares total " + totalPercentage + "%, expected approximately 100%");
        }

        boolean hasInvalidShare = mix.stream()
                .anyMatch(share -> !Double.isFinite(share.perc())
                        || share.perc() < 0
                        || share.perc() > 100);

        if (hasInvalidShare) {
            problems.add("generation share is outside 0-100%");
        }

        if (!problems.isEmpty()) {
            throw new IllegalStateException("[CARBON INTENSITY API REST CLIENT] Invalid /generation data: " + String.join("; ", problems));
        }
    }

    private void requireUsableIntensity(Intensity.Reading reading) {
        if (reading == null) {
            throw new IllegalStateException("[CARBON INTENSITY API REST CLIENT] Invalid /intensity data: no reading returned");
        }

        Integer gramsPerKwh = reading.actual() != null
                ? reading.actual()
                : reading.forecast();

        if (gramsPerKwh == null || gramsPerKwh < 0) {
            throw new IllegalStateException("[CARBON INTENSITY API REST CLIENT] Invalid /intensity data: no non-negative actual or forecast value");
        }
    }
}
