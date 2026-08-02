package com.example.demo.insight;

import com.anthropic.client.AnthropicClient;


//Wraps the Anthropic client. If we never set an API key it will still work but unable to call our analyst
public record AnthropicClientHolder(AnthropicClient client) {

    public boolean available() {
        return client != null;
    }
}
