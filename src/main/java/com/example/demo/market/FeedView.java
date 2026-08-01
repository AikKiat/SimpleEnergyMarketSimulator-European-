package com.example.demo.market;

/**
 *
 * 
 * 
 * However, still need to register for an Elexon api key!!!
 *
 * @param status   one of {@link Status}
 * @param source   human-readable provider, e.g. "Carbon Intensity API"
 * @param endpoint where the data physically comes from, so the UI can attribute
 *                 it precisely rather than saying something vague like "live data"
 * @param region   the market this covers, e.g. "Great Britain"
 * @param cost     what it costs to use, e.g. "Free, no key"
 * @param note     why it is unavailable, when it is
 * @param data     the payload; null unless status is AVAILABLE
 */
public record FeedView(
        Status status,
        String source,
        String endpoint,
        String region,
        String cost,
        String note,
        Object data) {

    public enum Status {
        AVAILABLE,
        NOT_WIRED,
        UNAVAILABLE
    }

    public static FeedView available(String source, String endpoint, String region, String cost, Object data) {
        return new FeedView(Status.AVAILABLE, source, endpoint, region, cost, null, data);
    }

    public static FeedView notWired(String source, String endpoint, String region, String cost, String note) {
        return new FeedView(Status.NOT_WIRED, source, endpoint, region, cost, note, null);
    }

    public static FeedView unavailable(String source, String endpoint, String region, String cost, String note) {
        return new FeedView(Status.UNAVAILABLE, source, endpoint, region, cost, note, null);
    }
}