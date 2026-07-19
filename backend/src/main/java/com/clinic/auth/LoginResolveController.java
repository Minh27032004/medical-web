package com.clinic.auth;

import com.clinic.admin.SupabaseAuthAdminClient;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Resolve định danh đăng nhập → email auth Supabase (public — chạy TRƯỚC khi có JWT).
 *
 * Tài khoản có Gmail thì email auth = Gmail (V8/D15, để Google auto-link), nên khi
 * bác sĩ gõ USERNAME không thể ghép máy móc <username>@clinic.local như trước —
 * phải tra email auth thật từ bảng users.
 *
 * Chống dò username: username không tồn tại vẫn trả email ảo hợp lệ → đăng nhập
 * fail y hệt "sai mật khẩu", không phân biệt được username có thật hay không.
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class LoginResolveController {

    private final UserRepository userRepository;

    public record ResolveRequest(String loginId) {}

    public record ResolveResponse(String email) {}

    @PostMapping("/resolve-login")
    public ResolveResponse resolve(@RequestBody ResolveRequest req) {
        var id = req.loginId() == null ? "" : req.loginId().trim().toLowerCase();
        if (id.contains("@")) return new ResolveResponse(id);
        var email = userRepository.findByUsername(id)
            .map(User::getEmail)
            .filter(e -> e != null && !e.isBlank())
            .orElse(id + SupabaseAuthAdminClient.EMAIL_DOMAIN);
        return new ResolveResponse(email);
    }
}
