package com.example.demo.kafka.producer;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.example.demo.ingestion.carbon.CarbonIntensityClient;
import com.example.demo.ingestion.domain_contract.MarketData;
import com.example.demo.kafka.topics.Topics;

/**
 * The producer end of the ETL: on a schedule, pulls live GB market data and
 * publishes it to the {@code market.data} topic.
 *
 * <p>A failed poll is logged and skipped rather than thrown — the projector
 * keeps serving the last good snapshot, and one flaky upstream call should
 * never take the API down.
 */
@Component
public class MarketDataPoller {

    private static final Logger log = LoggerFactory.getLogger(MarketDataPoller.class);

    private final CarbonIntensityClient client;
    private final KafkaTemplate<Object, Object> kafka;

    public MarketDataPoller(CarbonIntensityClient client, KafkaTemplate<Object, Object> kafka) {
        this.client = client;
        this.kafka = kafka;
    }

    @Scheduled(fixedDelayString = "${app.ingestion.carbon-intensity.poll-interval-ms}")
    public void poll() {
        try {
            MarketData data = client.fetchCurrentMarketData();
            if (data == null){
                log.warn("[MARKET DATA POLLER on CARBON INTENSITY API REST CLIENT] Error, the returned MarketData object from the Rest client is null. Check errors in querying the external api service.");
                return; // nothing to publish --> projector will keep serving the last good reading
            }
           
            kafka.send(Topics.MARKET_DATA, data.from(), data);
            log.info("Published market data {} -> {} ({} fuels, {} gCO2/kWh)", data.from(), data.to(), data.mix().size(), data.carbonIntensityGramsPerKwh());
        

        } catch (Exception e) {
            log.warn("[MARKET DATA POLLER] Market data poll failed: {}", e.getMessage());
        }
    }
}
