package com.clinic.chat;

import com.clinic.common.ApiException;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

/** Gọi Gemini — CHỈ để phân loại intent + trích tham số (D13: không RAG, không sinh SQL). */
@Slf4j
@Service
public class GeminiClient {

    /**
     * Không có timeout thì RestClient chờ VÔ HẠN: Gemini treo là luồng Tomcat treo theo,
     * bác sĩ nhìn "Đang tra cứu..." mãi không dứt. Phân loại 1 trong 10 intent mà quá 5s
     * thì coi như hỏng — thà trả lời "không hiểu kèm gợi ý" còn hơn bắt chờ tiếp.
     */
    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(3);
    private static final Duration READ_TIMEOUT = Duration.ofSeconds(5);

    private final RestClient rest;
    private final String apiKey;
    private final String model;

    public GeminiClient(
        @Value("${app.gemini.api-key}") String apiKey,
        @Value("${app.gemini.model}") String model
    ) {
        this.apiKey = apiKey;
        this.model = model;
        var factory = new JdkClientHttpRequestFactory(
            HttpClient.newBuilder().connectTimeout(CONNECT_TIMEOUT).build());
        factory.setReadTimeout(READ_TIMEOUT);
        this.rest = RestClient.builder()
            .baseUrl("https://generativelanguage.googleapis.com/v1beta")
            .requestFactory(factory)
            .build();
    }

    @SuppressWarnings("unchecked")
    public String generate(String systemPrompt, String userMessage) {
        var started = System.nanoTime();
        try {
            var body = Map.of(
                "system_instruction", Map.of("parts", List.of(Map.of("text", systemPrompt))),
                "contents", List.of(Map.of(
                    "role", "user",
                    "parts", List.of(Map.of("text", userMessage))
                )),
                // temperature 0: phân loại intent cần ỔN ĐỊNH, cùng câu hỏi phải ra cùng kết quả.
                // maxOutputTokens: JSON trả về chỉ vài chục token; chặn trên để một lần model
                // "lan man" không kéo dài thời gian chờ của bác sĩ.
                "generationConfig", Map.of(
                    "responseMimeType", "application/json",
                    "temperature", 0,
                    "maxOutputTokens", 256)
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
        } finally {
            // Đo riêng chặng LLM: đây là chặng tốn nhất của chat, cần nhìn được trong log
            // Render mà không phải đoán "chậm ở model hay ở DB".
            log.info("Gemini classify {} — {} ms", model, (System.nanoTime() - started) / 1_000_000);
        }
    }
}
