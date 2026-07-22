package com.clinic.config;

import com.clinic.auth.UserRoleConverter;
import java.nio.charset.StandardCharsets;
import java.util.List;
import javax.crypto.spec.SecretKeySpec;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.util.StringUtils;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final UserRoleConverter userRoleConverter;

    @Value("${app.frontend-origin}")
    private String frontendOrigin;

    @Value("${spring.security.oauth2.resourceserver.jwt.jwk-set-uri:}")
    private String jwkSetUri;

    @Value("${app.supabase.jwt-secret:}")
    private String jwtSecret;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(csrf -> csrf.disable()) // API stateless + JWT Bearer, không dùng cookie phiên
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                // Hệ NỘI BỘ (D13): public chỉ có health check + resolve email đăng nhập
                .requestMatchers("/actuator/health").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/auth/resolve-login").permitAll()
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .requestMatchers("/api/doctor/**").hasRole("DOCTOR")
                .requestMatchers("/api/me/**").authenticated()
                .anyRequest().denyAll())
            .oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt.jwtAuthenticationConverter(userRoleConverter)));
        return http.build();
    }

    /**
     * Supabase project mới ký JWT bất đối xứng (verify qua JWKS endpoint);
     * project cũ dùng HS256 với shared secret. Ưu tiên JWKS.
     */
    @Bean
    public JwtDecoder jwtDecoder() {
        if (StringUtils.hasText(jwkSetUri)) {
            // Supabase ký ES256; mặc định của Spring chỉ nhận RS256 nên phải khai báo thêm
            return NimbusJwtDecoder.withJwkSetUri(jwkSetUri)
                .jwsAlgorithms(algs -> {
                    algs.add(SignatureAlgorithm.ES256);
                    algs.add(SignatureAlgorithm.RS256);
                })
                .build();
        }
        if (StringUtils.hasText(jwtSecret)) {
            var key = new SecretKeySpec(jwtSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            return NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
        }
        throw new IllegalStateException(
            "Thiếu cấu hình JWT: đặt SUPABASE_JWKS_URI hoặc SUPABASE_JWT_SECRET");
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        var config = new CorsConfiguration();
        // FRONTEND_ORIGIN nhận nhiều origin cách nhau dấu phẩy (prod + preview...)
        var origins = new java.util.ArrayList<>(
            java.util.Arrays.stream(frontendOrigin.split(","))
                .map(String::trim).filter(s -> !s.isBlank()).toList());
        /*
         * CHỈ mở cho localhost khi đây thực sự là môi trường dev.
         *
         * Trước đây localhost:3000 được thêm VÔ ĐIỀU KIỆN, nghĩa là backend production
         * cũng chấp nhận request từ máy bất kỳ đang chạy dev server. Token vẫn phải hợp lệ
         * nên đây không phải lỗ hổng tự thân, nhưng nó biến một token bị lộ (máy bác sĩ bị
         * chiếm, XSS ở đâu đó) thành khai thác được ngay từ trình duyệt của kẻ tấn công —
         * trong khi CORS sinh ra chính là để bịt đường đó.
         *
         * Dấu hiệu "đang là dev": FRONTEND_ORIGIN tự nó trỏ về localhost. Trên Render biến
         * này là domain Vercel thật (xem docs/DEPLOY.md) nên nhánh dưới không chạy.
         */
        var isLocalDev = origins.stream().anyMatch(o -> o.startsWith("http://localhost"));
        if (isLocalDev && !origins.contains("http://localhost:3000")) {
            origins.add("http://localhost:3000");
        }
        config.setAllowedOrigins(origins);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        config.setMaxAge(3600L);
        var source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
