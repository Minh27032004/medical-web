package com.clinic.auth;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import lombok.RequiredArgsConstructor;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.InvalidBearerTokenException;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

/**
 * JWT hợp lệ (Supabase ký) → tra bảng users:
 * - Không có row (KHÔNG tự tạo — chỉ admin cấp tài khoản) → từ chối.
 * - is_blocked → từ chối ngay dù token còn hạn.
 * Cache 60s để không query DB mỗi request nhưng khóa tài khoản vẫn có hiệu lực nhanh.
 */
@Component
@RequiredArgsConstructor
public class UserRoleConverter implements Converter<Jwt, AbstractAuthenticationToken> {

    private static final Duration CACHE_TTL = Duration.ofSeconds(60);

    private final UserRepository userRepository;

    private record Cached(String role, boolean blocked, Instant expiresAt) {}

    private final Map<UUID, Cached> cache = new ConcurrentHashMap<>();

    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        var userId = UUID.fromString(jwt.getSubject());

        var cached = cache.get(userId);
        if (cached == null || cached.expiresAt().isBefore(Instant.now())) {
            var user = userRepository.findById(userId).orElse(null);
            cached = user == null
                ? new Cached(null, true, Instant.now().plus(CACHE_TTL))
                : new Cached(user.getRole(), user.isBlocked(), Instant.now().plus(CACHE_TTL));
            cache.put(userId, cached);
        }

        if (cached.role() == null) {
            throw new InvalidBearerTokenException("Tài khoản không tồn tại trong hệ thống");
        }
        if (cached.blocked()) {
            throw new InvalidBearerTokenException("Tài khoản đã bị khóa");
        }

        var authorities = List.of(new SimpleGrantedAuthority("ROLE_" + cached.role()));
        return new JwtAuthenticationToken(jwt, authorities, jwt.getSubject());
    }

    /** Gọi khi admin khóa/mở tài khoản để hiệu lực tức thì. */
    public void evict(UUID userId) {
        cache.remove(userId);
    }
}
