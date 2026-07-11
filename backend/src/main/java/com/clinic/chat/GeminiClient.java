package com.clinic.chat;

import com.clinic.common.ApiException;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

/** Gọi Gemini — CHỈ để phân loại intent + trích tham số (D13: không RAG, không sinh SQL). */
@Slf4j
@Service
public class GeminiClient {

    private final RestClient rest;
    private final String apiKey;
    private final String model;

    public GeminiClient(
        @Value("${app.gemini.api-key}") String apiKey,
        @Value("${app.gemini.model}") String model
    ) {
        this.apiKey = apiKey;
        this.model = model;
        this.rest = RestClient.builder()
            .baseUrl("https://generativelanguage.googleapis.com/v1beta")
            .build();
    }

    @SuppressWarnings("unchecked")
    public String generate(String systemPrompt, String userMessage) {
        try {
            var body = Map.of(
                "system_instruction", Map.of("parts", List.of(Map.of("text", systemPrompt))),
                "contents", List.of(Map.of(
                    "role", "user",
                    "parts", List.of(Map.of("text", userMessage))
                )),
                "generationConfig", Map.of("responseMimeType", "application/json")
            );
            var resp = rest.post()
                .uri("/models/{model}:generateContent?key={key}", model, apiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(Map.class);
            var candidates = (List<Map<String, Object>>) resp.get("candidates");
            var content = (Map<String, Object>) candidates.get(0).get("content");
            var parts = (List<Map<String, Object>>) content.get("parts");
            return ((String) parts.get(0).get("text")).trim();
        } catch (Exception e) {
            log.error("Gemini lỗi", e);
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "AI_UNAVAILABLE",
                "Trợ lý đang bận, thử lại sau");
        }
    }
}
