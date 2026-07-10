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
 * 1-1 với auth.users của Supabase (id = JWT sub).
 * Role nằm ở DB thay vì JWT claim để đổi role có hiệu lực ngay, không cần Auth Hook.
 */
@Entity
@Table(name = "profiles")
@Getter
@Setter
@NoArgsConstructor
public class Profile {

    public static final String ROLE_PATIENT = "PATIENT";
    public static final String ROLE_DOCTOR = "DOCTOR";

    @Id
    private UUID id;

    @Column(nullable = false)
    private String role = ROLE_PATIENT;

    @Column(name = "full_name")
    private String fullName;

    private String phone;

    @Column(name = "avatar_path")
    private String avatarPath;

    @Column(name = "created_at", nullable = false, updatable = false, insertable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;
}
