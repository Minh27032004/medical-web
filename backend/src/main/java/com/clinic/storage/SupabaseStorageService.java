package com.clinic.storage;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

/** Upload ảnh thuốc lên Supabase Storage bucket public medicine-images. */
@Service
public class SupabaseStorageService {

    private static final String BUCKET = "medicine-images";

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

    /** Upload, trả về path dạng "medicine-images/<uuid>.<ext>". */
    public String upload(String fileName, byte[] content, String contentType) {
        var path = BUCKET + "/" + fileName;
        rest.put()
            .uri("/storage/v1/object/" + path)
            .header("x-upsert", "true")
            .contentType(MediaType.parseMediaType(contentType))
            .body(content)
            .retrieve()
            .toBodilessEntity();
        return path;
    }

    /** URL công khai để hiển thị. */
    public String publicUrl(String path) {
        if (path == null || path.isBlank()) return null;
        return supabaseUrl + "/storage/v1/object/public/" + path;
    }
}
