package com.clinic.auth;

import com.clinic.common.ApiException;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/me")
@RequiredArgsConstructor
public class MeController {

    private final UserRepository userRepository;

    public record MeResponse(UUID id, String role, String username, String fullName,
                             String phone, String clinicName) {}

    @GetMapping("/profile")
    public MeResponse myProfile(@AuthenticationPrincipal Jwt jwt) {
        var u = userRepository.findById(UUID.fromString(jwt.getSubject()))
            .orElseThrow(() -> ApiException.notFound("Không tìm thấy tài khoản"));
        return new MeResponse(u.getId(), u.getRole(), u.getUsername(), u.getFullName(),
            u.getPhone(), u.getClinicName());
    }
}
