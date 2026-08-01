package com.example.demo.messaging;

//KAFKA topics
public final class Topics {

    //Live GB market data (generation mix + carbon intensity) from the ETL.
    public static final String MARKET_DATA = "market.data";

    //For the backend AI analyst
    public static final String INSIGHT_REQUESTS = "insight.requests";

    private Topics() {
    }
}
