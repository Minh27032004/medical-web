package com.clinic.storage;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.json.JsonParserFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

/** Upload ảnh thuốc lên Supabase Storage bucket public medicine-images. */
@Slf4j
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

    /**
     * Xóa một object. KHÔNG ném lỗi ra ngoài: đây luôn là việc dọn dẹp phụ, không được
     * làm hỏng thao tác chính (lưu thuốc, chạy job). Trả về true nếu xóa được.
     */
    public boolean delete(String path) {
        if (path == null || path.isBlank()) return false;
        try {
            rest.delete().uri("/storage/v1/object/" + path).retrieve().toBodilessEntity();
            return true;
        } catch (RuntimeException e) {
            log.warn("Không xóa được file storage {}: {}", path, e.toString());
            return false;
        }
    }

    /** Một object trong bucket — name là tên file, không kèm tên bucket. */
    public record StoredObject(String name, Instant createdAt) {}

    /** Liệt kê object trong bucket ảnh thuốc (tối đa 1000 — kho một phòng khám không vượt). */
    @SuppressWarnings("unchecked")
    public List<StoredObject> listMedicineImages() {
        var body = rest.post()
            .uri("/storage/v1/object/list/" + BUCKET)
            .contentType(MediaType.APPLICATION_JSON)
            .body("{\"limit\":1000,\"offset\":0,\"prefix\":\"\"}")
            .retrieve()
            .body(String.class);

        var out = new ArrayList<StoredObject>();
        for (var raw : JsonParserFactory.getJsonParser().parseList(body)) {
            var node = (Map<String, Object>) raw;
            var name = String.valueOf(node.getOrDefault("name", ""));
            if (name.isBlank() || "null".equals(name)) continue;
            out.add(new StoredObject(name, parseCreatedAt(node.get("created_at"))));
        }
        return out;
    }

    /** created_at có thể thiếu hoặc sai định dạng → coi như MỚI để job dọn không dám đụng. */
    private static Instant parseCreatedAt(Object value) {
        if (value == null) return Instant.now();
        try {
            return Instant.parse(String.valueOf(value));
        } catch (RuntimeException e) {
            return Instant.now();
        }
    }

    /** Tên file (không kèm bucket) → path đầy đủ để gọi API xóa. */
    public String pathOf(String fileName) {
        return BUCKET + "/" + fileName;
    }

    /** Bỏ tiền tố bucket khỏi image_path lưu trong DB để so khớp với tên file trong bucket. */
    public static String fileNameOf(String storedPath) {
        if (storedPath == null) return null;
        var prefix = BUCKET + "/";
        return storedPath.startsWith(prefix) ? storedPath.substring(prefix.length()) : storedPath;
    }
}
