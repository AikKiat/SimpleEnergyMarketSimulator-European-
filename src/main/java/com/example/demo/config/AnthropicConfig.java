package com.example.demo.config;

import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.example.demo.insight.AnthropicClientHolder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Builds the Anthropic client if — and only if — a key is present.
 * Without one the app still starts and every other feature works; requests to
 * /api/insight simply come back as FAILED with a clear message.
 */
// AI analyst disabled for now
// @Configuration
public class AnthropicConfig {

    private static final Logger log = LoggerFactory.getLogger(AnthropicConfig.class);

    @Bean
    AnthropicClientHolder anthropicClientHolder() {
        String key = System.getenv("ANTHROPIC_API_KEY");
        if (key == null || key.isBlank()) {
            log.warn("ANTHROPIC_API_KEY not set — the market analyst is disabled. "
                    + "Everything else runs normally.");
            return new AnthropicClientHolder(null);
        }
        log.info("Anthropic client configured — market analyst enabled");
        return new AnthropicClientHolder(AnthropicOkHttpClient.fromEnv());
    }
}
