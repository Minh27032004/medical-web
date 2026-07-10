package com.clinic.chat;

import com.clinic.chat.ChatService.ChatState;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Chat công khai: Patient dùng JWT, khách vãng lai dùng anonKey (uuid FE tự sinh).
 * JWT (nếu có) luôn được ưu tiên — anonKey bị bỏ qua khi đã đăng nhập.
 */
@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;

    public record SendRequest(
        @NotBlank(message = "Tin nhắn trống") @Size(max = 2000) String content,
        UUID anonKey
    ) {}

    private static UUID profileId(Jwt jwt) {
        return jwt == null ? null : UUID.fromString(jwt.getSubject());
    }

    @GetMapping
    public ChatState state(
        @AuthenticationPrincipal Jwt jwt,
        @RequestParam(required = false) UUID anonKey
    ) {
        return chatService.getState(profileId(jwt), anonKey);
    }

    @PostMapping("/messages")
    public ChatState send(
        @AuthenticationPrincipal Jwt jwt,
        @Valid @RequestBody SendRequest req
    ) {
        return chatService.sendMessage(profileId(jwt), req.anonKey(), req.content());
    }

    /** Chỉ người đã đăng nhập mới gặp bác sĩ trực tiếp được. */
    @PostMapping("/meet-doctor")
    public ChatState meetDoctor(@AuthenticationPrincipal Jwt jwt) {
        if (jwt == null) {
            throw com.clinic.common.ApiException.forbidden("Đăng nhập để chat với bác sĩ");
        }
        return chatService.requestDoctor(UUID.fromString(jwt.getSubject()));
    }
}
