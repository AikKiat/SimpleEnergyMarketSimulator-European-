package com.example.demo.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.demo.dto.MarketSnapshot;
import com.example.demo.kafka.consumer.MarketProjector;


@RestController
@RequestMapping("/api/market")
public class MarketController {

    private final MarketProjector projector;

    public MarketController(MarketProjector projector) {
        this.projector = projector;
    }

    @GetMapping("/live")
    public MarketSnapshot live() {
        return projector.snapshot();
    }
}
