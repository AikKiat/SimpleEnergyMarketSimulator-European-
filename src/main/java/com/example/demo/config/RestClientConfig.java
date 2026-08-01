package com.example.demo.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

/** Builds the HTTP client used to call the Carbon Intensity API. */
@Configuration
public class RestClientConfig {

    @Bean
    RestClient carbonIntensityRestClient(@Value("${app.ingestion.carbon-intensity.base-url}") String baseUrl) {
        return RestClient.builder().baseUrl(baseUrl).build();
    }
}
