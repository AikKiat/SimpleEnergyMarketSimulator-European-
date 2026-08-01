package com.example.demo.insight;

/**
 * The analyst's answer, in four fixed fields.
**/
public record Insight(
        String headline,
        String why,
        String watchNext,
        String action) {
}
