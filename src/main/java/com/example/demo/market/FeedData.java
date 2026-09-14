package com.example.demo.market;

import java.util.Map;


//sealed interface --> control which classes can implement
public sealed interface FeedData permits FeedData.GenerationMix, FeedData.CarbonIntensity {

    record GenerationMix(Map<String, Double> shares) implements FeedData {
    }

    record CarbonIntensity(Integer gramsPerKwh, String intensityIndex) implements FeedData {
    }
}