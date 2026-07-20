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

/** Bệnh nhân — thuộc về MỘT bác sĩ (doctor_id, cô lập tuyệt đối). Phòng khám người lớn. */
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

    @Column(name = "doctor_id", nullable = false, updatable = false)
    private UUID doctorId;

    @Column(name = "full_name", nullable = false)
    private String fullName;

    private String phone;

    /** male | female | other — tùy chọn. */
    private String gender;

    /** Tuổi — TÙY CHỌN, null = chưa ghi. Không tự tăng theo thời gian (V13). */
    private Integer age;

    private String address;

    @Column(name = "has_drug_allergy", nullable = false)
    private boolean hasDrugAllergy = false;

    @Column(name = "drug_allergy_note")
    private String drugAllergyNote;

    @Column(name = "has_chronic_condition", nullable = false)
    private boolean hasChronicCondition = false;

    @Column(name = "chronic_condition_note")
    private String chronicConditionNote;

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
