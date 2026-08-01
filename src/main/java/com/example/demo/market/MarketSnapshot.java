package com.example.demo.market;

import java.time.Instant;
import java.util.Map;


public record MarketSnapshot(
        Instant at,
        String settlement,
        Map<String, FeedView> feeds) {
}