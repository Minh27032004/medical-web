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

    private static final Map<String, String> ALLOWED_TYPES = Map.of(
        "image/jpeg", "jpg",
        "image/png", "png",
        "image/webp", "webp"
    );
    private static final long MAX_SIZE_BYTES = 5 * 1024 * 1024;

    private final SupabaseStorageService storage;

    /** Upload ảnh thuốc → bucket public medicine-images. Trả về path (lưu DB) + url (hiển thị). */
    @PostMapping(value = "/medicine-image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, String> uploadMedicineImage(@RequestParam("file") MultipartFile file) {
        var ext = validate(file);
        var path = "medicine-images/" + UUID.randomUUID() + "." + ext;
        try {
            storage.upload(path, file.getBytes(), file.getContentType());
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return Map.of("path", path, "url", storage.publicUrl(path));
    }

    private String validate(MultipartFile file) {
        if (file.isEmpty()) throw ApiException.badRequest("File rỗng");
        if (file.getSize() > MAX_SIZE_BYTES) throw ApiException.badRequest("Ảnh tối đa 5MB");
        var ext = ALLOWED_TYPES.get(file.getContentType());
        if (ext == null) {
            throw ApiException.badRequest("Chỉ nhận ảnh JPEG, PNG hoặc WebP, nhận được: "
                + file.getContentType());
        }
        return ext;
    }
}
