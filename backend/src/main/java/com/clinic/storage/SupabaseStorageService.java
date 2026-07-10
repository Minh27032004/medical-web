package com.clinic.storage;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

/**
 * Nói chuyện với Supabase Storage bằng service key (chỉ backend giữ).
 * - Bucket public (medicine-images): trả URL công khai.
 * - Bucket private (medical-docs): sẽ dùng signed URL khi làm module ảnh y tế.
 */
@Service
public class SupabaseStorageService {

    private final RestClient rest;
    private final String supabaseUrl;

    public SupabaseStorageService(
        @Value("${app.supabase.url}") String supabaseUrl,
        @Value("${app.supabase.service-role-key}") String serviceKey
    ) {
        this.supabaseUrl = supabaseUrl;
        this.rest = RestClient.builder()
            .baseUrl(supabaseUrl)
            .defaultHeader("apikey", serviceKey)
            .defaultHeader("Authorization", "Bearer " + serviceKey)
            .build();
    }

    /**
     * Upload lên bucket, path dạng "ten-bucket/ten-file.ext".
     * x-upsert=true để ghi đè nếu trùng path (path luôn kèm UUID nên hiếm khi xảy ra).
     */
    public String upload(String path, byte[] content, String contentType) {
        rest.put()
            .uri("/storage/v1/object/" + path)
            .header("x-upsert", "true")
            .contentType(MediaType.parseMediaType(contentType))
            .body(content)
            .retrieve()
            .toBodilessEntity();
        return path;
    }

    /** URL công khai cho file thuộc bucket public. */
    public String publicUrl(String path) {
        if (path == null || path.isBlank()) return null;
        return supabaseUrl + "/storage/v1/object/public/" + path;
    }

    /**
     * Signed URL có hạn dùng cho bucket PRIVATE (ảnh y tế) — chỉ ai được backend
     * cấp link mới xem được, link tự hết hạn.
     */
    @SuppressWarnings("unchecked")
    public String signedUrl(String path, int expiresSeconds) {
        if (path == null || path.isBlank()) return null;
        var resp = rest.post()
            .uri("/storage/v1/object/sign/" + path)
            .contentType(MediaType.APPLICATION_JSON)
            .body(java.util.Map.of("expiresIn", expiresSeconds))
            .retrieve()
            .body(java.util.Map.class);
        return supabaseUrl + "/storage/v1" + resp.get("signedURL");
    }
}
