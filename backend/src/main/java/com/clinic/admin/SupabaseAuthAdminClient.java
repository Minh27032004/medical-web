package com.clinic.admin;

import com.clinic.common.ApiException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

/** Gọi Supabase Auth Admin API bằng service key — tạo/xóa auth user cho bác sĩ (D15). */
@Slf4j
@Service
public class SupabaseAuthAdminClient {

    /** Domain email ảo: username 'teo' ⇔ teo@clinic.local. */
    public static final String EMAIL_DOMAIN = "@clinic.local";

    private final RestClient rest;

    public SupabaseAuthAdminClient(
        @Value("${app.supabase.url}") String supabaseUrl,
        @Value("${app.supabase.service-role-key}") String serviceKey
    ) {
        this.rest = RestClient.builder()
            .baseUrl(supabaseUrl)
            .defaultHeader("apikey", serviceKey)
            .defaultHeader("Authorization", "Bearer " + serviceKey)
            .build();
    }

    /** Tạo auth user bằng username (email ảo <username>@clinic.local). Giữ tương thích cũ. */
    public UUID createUser(String username, String password) {
        return createAuthUser(username + EMAIL_DOMAIN, password);
    }

    /**
     * Tạo auth user với EMAIL thật (Gmail) + mật khẩu TÙY CHỌN (null = chỉ đăng nhập Google).
     * Email tự xác nhận để Google auto-link đúng user này khi bác sĩ đăng nhập bằng Gmail đó.
     *
     * NHẬN LẠI (adopt) auth user mồ côi: nếu email đã có sẵn trong auth.users — thường do bác sĩ
     * lỡ bấm "Đăng nhập Google" trước khi được cấp quyền, Supabase đã tạo sẵn auth user nhưng chưa
     * có row trong bảng users — thì dùng lại đúng id đó (và đặt mật khẩu nếu admin có nhập) thay vì
     * báo lỗi "email đã tồn tại". An toàn vì AdminDoctorController đã kiểm tra email chưa gắn users nào.
     */
    @SuppressWarnings("unchecked")
    public UUID createAuthUser(String email, String password) {
        var body = new java.util.HashMap<String, Object>();
        body.put("email", email);
        body.put("email_confirm", true);
        if (password != null && !password.isBlank()) {
            body.put("password", password);
        }
        try {
            var resp = rest.post()
                .uri("/auth/v1/admin/users")
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(Map.class);
            var id = (String) resp.get("id");
            if (id == null) throw new IllegalStateException("Supabase không trả id");
            return UUID.fromString(id);
        } catch (RestClientResponseException e) {
            if (isEmailExists(e)) {
                var existing = findAuthUserIdByEmail(email);
                if (existing != null) {
                    if (password != null && !password.isBlank()) setPassword(existing, password);
                    log.info("Nhận lại auth user mồ côi cho email={} (id={})", email, existing);
                    return existing;
                }
            }
            log.error("Tạo auth user thất bại cho email={} — {} {}", email, e.getStatusCode(),
                e.getResponseBodyAsString());
            throw new ApiException(HttpStatus.BAD_GATEWAY, "AUTH_PROVIDER_ERROR",
                "Không tạo được tài khoản đăng nhập (email/username có thể đã tồn tại)");
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            log.error("Tạo auth user thất bại cho email={}", email, e);
            throw new ApiException(HttpStatus.BAD_GATEWAY, "AUTH_PROVIDER_ERROR",
                "Không tạo được tài khoản đăng nhập (email/username có thể đã tồn tại)");
        }
    }

    /** GoTrue trả 422 (bản cũ: 400/409) khi email đã đăng ký. Nhận diện qua status + body. */
    private static boolean isEmailExists(RestClientResponseException e) {
        if (!e.getStatusCode().is4xxClientError()) return false;
        var s = e.getResponseBodyAsString().toLowerCase();
        return s.contains("email_exists") || s.contains("already been registered")
            || s.contains("already registered") || s.contains("has already been");
    }

    /** Duyệt admin/users theo trang tìm đúng email (server không hỗ trợ filter). Null nếu không thấy. */
    @SuppressWarnings("unchecked")
    private UUID findAuthUserIdByEmail(String email) {
        for (int page = 1; page <= 200; page++) {
            final int p = page;
            var resp = rest.get()
                .uri(b -> b.path("/auth/v1/admin/users")
                    .queryParam("page", p).queryParam("per_page", 100).build())
                .retrieve()
                .body(Map.class);
            var users = resp == null ? null : (List<Map<String, Object>>) resp.get("users");
            if (users == null || users.isEmpty()) return null;
            for (var u : users) {
                if (email.equalsIgnoreCase((String) u.get("email"))) {
                    return UUID.fromString((String) u.get("id"));
                }
            }
        }
        return null;
    }

    /** Đặt mật khẩu cho auth user đã có + đảm bảo email đã xác nhận (cho phép đăng nhập mật khẩu). */
    private void setPassword(UUID id, String password) {
        rest.put()
            .uri("/auth/v1/admin/users/{id}", id)
            .contentType(MediaType.APPLICATION_JSON)
            .body(Map.of("password", password, "email_confirm", true))
            .retrieve()
            .toBodilessEntity();
    }
}
