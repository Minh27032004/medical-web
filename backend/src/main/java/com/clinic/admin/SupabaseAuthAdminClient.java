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

    /** Tạo auth user, trả về id. Email tự xác nhận (hệ nội bộ, không có luồng email). */
    @SuppressWarnings("unchecked")
    public UUID createUser(String username, String password) {
        try {
            var resp = rest.post()
                .uri("/auth/v1/admin/users")
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of(
                    "email", username + EMAIL_DOMAIN,
                    "password", password,
                    "email_confirm", true))
                .retrieve()
                .body(Map.class);
            var id = (String) resp.get("id");
            if (id == null) throw new IllegalStateException("Supabase không trả id");
            return UUID.fromString(id);
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            log.error("Tạo auth user thất bại cho username={}", username, e);
            throw new ApiException(HttpStatus.BAD_GATEWAY, "AUTH_PROVIDER_ERROR",
                "Không tạo được tài khoản đăng nhập (username có thể đã tồn tại)");
        }
    }
}
