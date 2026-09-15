package com.example.demo.kafka.topics;

//KAFKA topics
public final class Topics {

    //Live GB market data (generation mix + carbon intensity) from the ETL.
    public static final String MARKET_DATA = "market.data.genmix.carbonint";

    //For the backend AI analyst
    public static final String INSIGHT_REQUESTS = "insight.requests";

    private Topics() {
    }
}
