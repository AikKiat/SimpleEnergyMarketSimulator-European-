package com.example.demo.market;

import jakarta.annotation.Nullable;

/**
 *
 * 
 * 
 * However, still need to register for an Elexon api key!!!
 *
 * @param status   one of {@link Status}--> WIRED, NOT_WIRED OR UNAVAILABLE
 * @param source   human-readable provider, e.g. "Carbon Intensity API"
 * @param endpoint where the data physically comes from
 * @param region   the market this covers
 * @param access   access requirement for the source
 * @param note     why it is unavailable --> sent to frontend, shown on dashboard
 * @param data     the payload; null unless status is AVAILABLE
 */
public record FeedView(
        Status status,
        String source,
        String endpoint,
        String region,
        String access, //Based on FeedAccss Enum --> we get the labels attached to each respective enum member
        String note,
        @Nullable FeedData data) {

    public enum Status {
        AVAILABLE,
        NOT_WIRED,
        UNAVAILABLE
    }

    public static FeedView available(String source, String endpoint, String region, String access, FeedData data) {
        return new FeedView(Status.AVAILABLE, source, endpoint, region, access, null, data);
    }

    public static FeedView notWired(String source, String endpoint, String region, String access, String note) {
        return new FeedView(Status.NOT_WIRED, source, endpoint, region, access, note, null);
    }

    public static FeedView unavailable(String source, String endpoint, String region, String access, String note) {
        return new FeedView(Status.UNAVAILABLE, source, endpoint, region, access, note, null);
    }
}