package com.clinic.patient;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;

/**
 * Hồ sơ bệnh nhân do Doctor tạo khi khám. profileId nullable —
 * bệnh nhân walk-in không có tài khoản vẫn có hồ sơ (D2).
 */
@Entity
@Table(name = "patients")
@Getter
@Setter
@NoArgsConstructor
public class Patient {

    @Id
    @GeneratedValue
    @UuidGenerator
    private UUID id;

    @Column(name = "profile_id")
    private UUID profileId;

    @Column(name = "full_name", nullable = false)
    private String fullName;

    private String phone;

    private Integer age;

    /** Ảnh chân dung — bucket PRIVATE (dữ liệu định danh bệnh nhân). */
    @Column(name = "photo_path")
    private String photoPath;

    private String note;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }
}
