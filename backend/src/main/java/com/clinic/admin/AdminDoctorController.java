package com.clinic.admin;

import com.clinic.auth.User;
import com.clinic.auth.UserRepository;
import com.clinic.auth.UserRoleConverter;
import com.clinic.common.ApiException;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.transaction.annotation.Transactional;

/**
 * Admin quản lý tài khoản bác sĩ (đặc tả §5.1).
 * Admin KHÔNG có endpoint nào đọc dữ liệu lâm sàng.
 */
@RestController
@RequestMapping("/api/admin/doctors")
@RequiredArgsConstructor
public class AdminDoctorController {

    private final UserRepository userRepository;
    private final SupabaseAuthAdminClient authAdmin;
    private final UserRoleConverter roleConverter;

    public record CreateDoctorRequest(String username, String password, String email,
                                      String fullName, String phone, String clinicName) {}

    public record DoctorRow(UUID id, String username, String email, String fullName, String phone,
                            String clinicName, boolean blocked, Instant createdAt) {}

    private static DoctorRow toRow(User u) {
        return new DoctorRow(u.getId(), u.getUsername(), u.getEmail(), u.getFullName(),
            u.getPhone(), u.getClinicName(), u.isBlocked(), u.getCreatedAt());
    }

    @GetMapping
    public List<DoctorRow> list() {
        return userRepository.findByRoleOrderByCreatedAtDesc(User.ROLE_DOCTOR).stream()
            .map(AdminDoctorController::toRow)
            .toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public DoctorRow create(@RequestBody CreateDoctorRequest req) {
        var fullName = req.fullName() == null ? "" : req.fullName().trim();
        if (fullName.isBlank()) throw ApiException.badRequest("Thiếu họ tên bác sĩ");

        var username = req.username() == null ? "" : req.username().trim().toLowerCase();
        var email = req.email() == null ? "" : req.email().trim().toLowerCase();
        var password = req.password() == null ? "" : req.password();
        boolean hasUsername = !username.isBlank();
        boolean hasEmail = !email.isBlank();
        boolean hasPassword = !password.isBlank();

        // Đăng nhập được ít nhất 1 cách: Gmail (Google) HOẶC username + mật khẩu.
        if (!hasEmail && !(hasUsername && hasPassword)) {
            throw ApiException.badRequest("Cần Gmail (đăng nhập Google) hoặc username + mật khẩu");
        }
        if (hasUsername && !username.matches("^[a-z0-9_.-]{3,30}$")) {
            throw ApiException.badRequest("Username 3-30 ký tự: chữ thường, số, dấu chấm/gạch");
        }
        if (hasPassword && password.length() < 8) {
            throw ApiException.badRequest("Mật khẩu tối thiểu 8 ký tự");
        }
        if (hasEmail && !email.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) {
            throw ApiException.badRequest("Gmail không hợp lệ");
        }
        if (hasUsername && userRepository.findByUsername(username).isPresent()) {
            throw ApiException.conflict("Username đã tồn tại");
        }
        if (hasEmail && userRepository.findByEmailIgnoreCase(email).isPresent()) {
            throw ApiException.conflict("Gmail đã được cấp cho tài khoản khác");
        }

        // Email auth Supabase: ưu tiên Gmail (để Google auto-link đúng user); else email ảo theo username.
        var authEmail = hasEmail ? email : username + SupabaseAuthAdminClient.EMAIL_DOMAIN;
        var authId = authAdmin.createAuthUser(authEmail, hasPassword ? password : null);

        var u = new User();
        u.setId(authId);
        u.setRole(User.ROLE_DOCTOR);
        u.setUsername(hasUsername ? username : null);
        u.setEmail(hasEmail ? email : null);
        u.setFullName(fullName);
        u.setPhone(req.phone());
        u.setClinicName(req.clinicName());
        return toRow(userRepository.save(u));
    }

    @PatchMapping("/{id}/block")
    public void block(@PathVariable UUID id) {
        setBlocked(id, true);
    }

    @PatchMapping("/{id}/unblock")
    public void unblock(@PathVariable UUID id) {
        setBlocked(id, false);
    }

    private void setBlocked(UUID id, boolean blocked) {
        var u = userRepository.findById(id)
            .orElseThrow(() -> ApiException.notFound("Không tìm thấy bác sĩ"));
        if (!User.ROLE_DOCTOR.equals(u.getRole())) {
            throw ApiException.badRequest("Chỉ khóa/mở được tài khoản bác sĩ");
        }
        u.setBlocked(blocked);
        u.setUpdatedAt(Instant.now());
        userRepository.save(u);
        roleConverter.evict(id); // hiệu lực ngay, không chờ cache hết hạn
    }
}
