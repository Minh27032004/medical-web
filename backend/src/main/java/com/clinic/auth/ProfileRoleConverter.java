package com.clinic.auth;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

/**
 * JWT hợp lệ (Supabase ký) → tra role trong bảng profiles → ROLE_PATIENT / ROLE_DOCTOR.
 */
@Component
@RequiredArgsConstructor
public class ProfileRoleConverter implements Converter<Jwt, AbstractAuthenticationToken> {

    private final ProfileService profileService;

    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        var userId = UUID.fromString(jwt.getSubject());
        var role = profileService.resolveRole(userId, extractFullName(jwt));
        var authorities = List.of(new SimpleGrantedAuthority("ROLE_" + role));
        return new JwtAuthenticationToken(jwt, authorities, jwt.getSubject());
    }

    /** Họ tên nhập lúc đăng ký nằm trong claim user_metadata — dùng khi tạo profile lần đầu. */
    private static String extractFullName(Jwt jwt) {
        Map<String, Object> meta = jwt.getClaimAsMap("user_metadata");
        if (meta == null) return null;
        var name = meta.get("full_name");
        return name instanceof String s && !s.isBlank() ? s : null;
    }
}
