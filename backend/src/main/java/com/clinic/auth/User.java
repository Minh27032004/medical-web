package com.clinic.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Tài khoản hệ thống (1-1 với auth.users của Supabase — id = JWT sub).
 * Mật khẩu do Supabase Auth quản lý (D15). username ⇔ email ảo <username>@clinic.local.
 */
@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
public class User {

    public static final String ROLE_ADMIN = "ADMIN";
    public static final String ROLE_DOCTOR = "DOCTOR";

    @Id
    private UUID id;

    @Column(nullable = false)
    private String role;

    @Column(unique = true)
    private String username;

    /** Gmail (đăng nhập Google). Có Gmail → email auth Supabase = Gmail này. Null = tài khoản chỉ username. */
    @Column(unique = true)
    private String email;

    @Column(name = "full_name")
    private String fullName;

    private String phone;

    /** Tên phòng khám — in trên đơn thuốc. */
    @Column(name = "clinic_name")
    private String clinicName;

    /** Bị khóa → chặn ở JWT converter mỗi request, dù token còn hạn. */
    @Column(name = "is_blocked", nullable = false)
    private boolean blocked = false;

    @Column(name = "created_at", nullable = false, updatable = false, insertable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;
}
