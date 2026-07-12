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
     */
    @SuppressWarnings("unchecked")
    public UUID createAuthUser(String email, String password) {
        try {
            var body = new java.util.HashMap<String, Object>();
            body.put("email", email);
            body.put("email_confirm", true);
            if (password != null && !password.isBlank()) {
                body.put("password", password);
            }
            var resp = rest.post()
                .uri("/auth/v1/admin/users")
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(Map.class);
            var id = (String) resp.get("id");
            if (id == null) throw new IllegalStateException("Supabase không trả id");
            return UUID.fromString(id);
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            log.error("Tạo auth user thất bại cho email={}", email, e);
            throw new ApiException(HttpStatus.BAD_GATEWAY, "AUTH_PROVIDER_ERROR",
                "Không tạo được tài khoản đăng nhập (email/username có thể đã tồn tại)");
        }
    }
}
