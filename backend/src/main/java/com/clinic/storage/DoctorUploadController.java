package com.clinic.storage;

import com.clinic.common.ApiException;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/doctor/uploads")
@RequiredArgsConstructor
public class DoctorUploadController {

    private static final Map<String, String> ALLOWED = Map.of(
        "image/jpeg", "jpg", "image/png", "png", "image/webp", "webp");
    private static final long MAX = 5 * 1024 * 1024;

    private final SupabaseStorageService storage;

    /** Upload ảnh thuốc → trả path (lưu DB) + url (hiển thị ngay). */
    @PostMapping(value = "/medicine-image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, String> uploadMedicineImage(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) throw ApiException.badRequest("File rỗng");
        if (file.getSize() > MAX) throw ApiException.badRequest("Ảnh tối đa 5MB");
        var ext = ALLOWED.get(file.getContentType());
        if (ext == null) throw ApiException.badRequest("Chỉ nhận ảnh JPEG, PNG hoặc WebP");
        try {
            // Nén TRƯỚC khi lưu: bác sĩ chụp vỏ hộp bằng điện thoại là ra file 3–5MB, trong khi
            // ảnh chỉ hiển thị ở cỡ 40–80px. Không nén thì tốn dung lượng bucket vĩnh viễn và
            // mỗi lần mở kho thuốc lại kéo về ngần ấy byte.
            var bytes = ImageShrinker.shrink(file.getBytes(), ext);
            var path = storage.upload(UUID.randomUUID() + "." + ext, bytes, file.getContentType());
            return Map.of("path", path, "url", storage.publicUrl(path));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
