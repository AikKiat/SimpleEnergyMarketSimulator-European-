package com.example.demo.config;

import com.example.demo.messaging.Topics;
import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;

/** Declares the topics so Spring's KafkaAdmin creates them on startup.
 *  Single partition / single replica is fine for local dev. */
@Configuration
public class KafkaTopicConfig {

    @Bean
    NewTopic marketDataTopic() {
        return TopicBuilder.name(Topics.MARKET_DATA).partitions(1).replicas(1).build();
    }

    @Bean
    NewTopic insightRequestsTopic() {
        return TopicBuilder.name(Topics.INSIGHT_REQUESTS).partitions(1).replicas(1).build();
    }
}
