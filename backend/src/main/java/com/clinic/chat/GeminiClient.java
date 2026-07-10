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

/** Gọi Gemini API: sinh câu trả lời (gemini-2.5-flash) và embedding (text-embedding-004). */
@Slf4j
@Service
public class GeminiClient {

    private final RestClient rest;
    private final String apiKey;
    private final String model;
    private final String embeddingModel;

    private final int embeddingDimensions;

    public GeminiClient(
        @Value("${app.gemini.api-key}") String apiKey,
        @Value("${app.gemini.model}") String model,
        @Value("${app.gemini.embedding-model}") String embeddingModel,
        @Value("${app.gemini.embedding-dimensions:768}") int embeddingDimensions
    ) {
        this.apiKey = apiKey;
        this.model = model;
        this.embeddingModel = embeddingModel;
        this.embeddingDimensions = embeddingDimensions;
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
                ))
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
            log.error("Gemini generate lỗi", e);
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "AI_UNAVAILABLE",
                "Trợ lý AI đang bận, vui lòng thử lại sau");
        }
    }

    /** Embedding 768 chiều — trả về chuỗi dạng "[0.1,0.2,...]" để cast thẳng sang pgvector. */
    @SuppressWarnings("unchecked")
    public String embedAsVectorLiteral(String text) {
        try {
            var body = Map.of(
                "model", "models/" + embeddingModel,
                "content", Map.of("parts", List.of(Map.of("text", text))),
                "outputDimensionality", embeddingDimensions
            );
            var resp = rest.post()
                .uri("/models/{model}:embedContent?key={key}", embeddingModel, apiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(Map.class);
            var embedding = (Map<String, Object>) resp.get("embedding");
            var values = (List<Number>) embedding.get("values");
            var sb = new StringBuilder("[");
            for (int i = 0; i < values.size(); i++) {
                if (i > 0) sb.append(',');
                sb.append(values.get(i));
            }
            return sb.append(']').toString();
        } catch (Exception e) {
            log.error("Gemini embed lỗi", e);
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "AI_UNAVAILABLE",
                "Không tạo được embedding, thử lại sau");
        }
    }
}
