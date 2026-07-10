package com.clinic.auth;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ProfileService {

    private static final Duration ROLE_CACHE_TTL = Duration.ofMinutes(5);

    private final ProfileRepository profileRepository;

    private record CachedRole(String role, Instant expiresAt) {}

    private final Map<UUID, CachedRole> roleCache = new ConcurrentHashMap<>();

    /**
     * Lấy role cho user; nếu là lần gọi API đầu tiên sau đăng ký thì tự tạo
     * profile PATIENT (Customer đăng nhập = trở thành Patient — xem D2).
     * Cache 5 phút để không query DB mỗi request.
     */
    @Transactional
    public String resolveRole(UUID userId) {
        var cached = roleCache.get(userId);
        if (cached != null && cached.expiresAt().isAfter(Instant.now())) {
            return cached.role();
        }
        var profile = getOrCreate(userId);
        roleCache.put(userId, new CachedRole(profile.getRole(), Instant.now().plus(ROLE_CACHE_TTL)));
        return profile.getRole();
    }

    @Transactional
    public Profile getOrCreate(UUID userId) {
        return profileRepository.findById(userId).orElseGet(() -> {
            var p = new Profile();
            p.setId(userId);
            p.setRole(Profile.ROLE_PATIENT);
            return profileRepository.save(p);
        });
    }

    /** Gọi khi Doctor đổi role/quyền để cache không giữ giá trị cũ. */
    public void evictRole(UUID userId) {
        roleCache.remove(userId);
    }
}
