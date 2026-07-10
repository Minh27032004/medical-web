package com.clinic.auth;

import java.util.List;
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
        var role = profileService.resolveRole(userId);
        var authorities = List.of(new SimpleGrantedAuthority("ROLE_" + role));
        return new JwtAuthenticationToken(jwt, authorities, jwt.getSubject());
    }
}
