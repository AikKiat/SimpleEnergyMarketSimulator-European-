package com.example.demo.market;

import com.example.demo.ingestion.model.FuelShare;
import com.example.demo.ingestion.model.MarketData;
import com.example.demo.messaging.Topics;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * The LOAD end of the ETL, and the read model behind {@code /api/market/live}.
 *
 * <p>Consumes {@code market.data} off Kafka and keeps the latest snapshot in
 * memory, shaped into the per-feed catalogue the frontend renders. Keeping the
 * projection separate from the poller is what lets the API keep answering from
 * the last good reading while an upstream call is failing.
 */
@Component
public class MarketProjector {

    private static final Logger log = LoggerFactory.getLogger(MarketProjector.class);

    private static final String CARBON_API = "Carbon Intensity API";
    private static final String CARBON_GENERATION = "api.carbonintensity.org.uk/generation";
    private static final String CARBON_INTENSITY = "api.carbonintensity.org.uk/intensity";
    private static final String GB = "Great Britain";
    private static final String FREE = "Free, no key";

    private volatile MarketData latest;


    @KafkaListener(topics = Topics.MARKET_DATA, groupId = "${spring.kafka.consumer.group-id}-market")
    public void onMarketData(MarketData data) {
        this.latest = data;
        log.info("Projected market data {} -> {} ({} gCO2/kWh)",
                data.from(), data.to(), data.carbonIntensityGramsPerKwh());
    }

    public MarketSnapshot snapshot() {
        MarketData data = this.latest;
        Map<String, FeedView> feeds = new LinkedHashMap<>();

        //Generation mix, available proxy
        if (data != null && data.mix() != null && !data.mix().isEmpty()) {
            Map<String, Double> shares = new LinkedHashMap<>();
            for (FuelShare share : data.mix()) {
                shares.put(share.fuel(), share.perc() / 100.0);
            }
            feeds.put("generationMix", FeedView.available(
                    CARBON_API, CARBON_GENERATION, GB, FREE, shares));
        } else {
            feeds.put("generationMix", FeedView.notWired(
                    CARBON_API, CARBON_GENERATION, GB, FREE,
                    "No reading yet — the first poll has not completed."));
        }

        //Carbon intensity
        if (data != null && data.carbonIntensityGramsPerKwh() != null) {
            Map<String, Object> intensity = new LinkedHashMap<>();
            intensity.put("gramsPerKwh", data.carbonIntensityGramsPerKwh());
            intensity.put("index", data.carbonIntensityIndex());
            feeds.put("carbonIntensity", FeedView.available(
                    CARBON_API, CARBON_INTENSITY, GB, FREE, intensity));
        } else {
            feeds.put("carbonIntensity", FeedView.notWired(
                    CARBON_API, CARBON_INTENSITY, GB, FREE,
                    "No reading yet — the first poll has not completed."));
        }

        //Day-ahead / system power price (API key needed. Need to register but have to wait for now)
        feeds.put("powerPrice", FeedView.notWired(
                "Elexon BMRS / ENTSO-E Transparency Platform",
                "bmrs.elexon.co.uk / transparency.entsoe.eu",
                "Great Britain / EU bidding zones",
                "Free, needs an API key",
                "Not integrated yet. Register for a key to enable this feed."));

        //Fuel and carbon PRICES (THis one is paid, so probably have to simulate in frontend first but at least we've wired it up in the pipeline)
        feeds.put("fuelPrices", FeedView.unavailable(
                "Commercial market data (ICE, EEX and similar)",
                "Subscription data terminals",
                "NBP/TTF gas, API2 coal, EU ETS carbon",
                "Paid",
                "Gas, coal and EU ETS prices have no free live feed — simulated via the sliders."));

        return new MarketSnapshot(
                Instant.now(),
                data == null ? null : data.from() + " -> " + data.to(),
                feeds);
    }
}