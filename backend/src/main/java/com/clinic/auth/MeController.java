package com.clinic.auth;

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

    private final ProfileService profileService;

    public record ProfileResponse(UUID id, String role, String fullName, String phone) {}

    /** Identity luôn lấy từ JWT sub — không bao giờ nhận id từ client. */
    @GetMapping("/profile")
    public ProfileResponse myProfile(@AuthenticationPrincipal Jwt jwt) {
        var p = profileService.getOrCreate(UUID.fromString(jwt.getSubject()));
        return new ProfileResponse(p.getId(), p.getRole(), p.getFullName(), p.getPhone());
    }
}
