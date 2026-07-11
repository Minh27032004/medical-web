package com.clinic.admin;

import com.clinic.auth.User;
import com.clinic.auth.UserRepository;
import com.clinic.auth.UserRoleConverter;
import com.clinic.common.ApiException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
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

    public record CreateDoctorRequest(
        @NotBlank @Pattern(regexp = "^[a-z0-9_.-]{3,30}$",
            message = "Username 3-30 ký tự: chữ thường, số, dấu chấm/gạch") String username,
        @NotBlank @Size(min = 8, message = "Mật khẩu tối thiểu 8 ký tự") String password,
        @NotBlank String fullName,
        String phone,
        String clinicName
    ) {}

    public record DoctorRow(UUID id, String username, String fullName, String phone,
                            String clinicName, boolean blocked, Instant createdAt) {}

    @GetMapping
    public List<DoctorRow> list() {
        return userRepository.findByRoleOrderByCreatedAtDesc(User.ROLE_DOCTOR).stream()
            .map(u -> new DoctorRow(u.getId(), u.getUsername(), u.getFullName(),
                u.getPhone(), u.getClinicName(), u.isBlocked(), u.getCreatedAt()))
            .toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public DoctorRow create(@Valid @RequestBody CreateDoctorRequest req) {
        var username = req.username().trim().toLowerCase();
        if (userRepository.findByUsername(username).isPresent()) {
            throw ApiException.conflict("Username đã tồn tại");
        }
        var authId = authAdmin.createUser(username, req.password());

        var u = new User();
        u.setId(authId);
        u.setRole(User.ROLE_DOCTOR);
        u.setUsername(username);
        u.setFullName(req.fullName().trim());
        u.setPhone(req.phone());
        u.setClinicName(req.clinicName());
        var saved = userRepository.save(u);
        return new DoctorRow(saved.getId(), saved.getUsername(), saved.getFullName(),
            saved.getPhone(), saved.getClinicName(), saved.isBlocked(), saved.getCreatedAt());
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
