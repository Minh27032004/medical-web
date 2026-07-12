package com.clinic.visit;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;

/** Lần khám (§4.3) — chẩn đoán ICD-10 bắt buộc, lưu snapshot cả mã lẫn tên. */
@Entity
@Table(name = "visits")
@Getter
@Setter
@NoArgsConstructor
public class Visit {

    @Id
    @GeneratedValue
    @UuidGenerator
    private UUID id;

    @Column(name = "doctor_id", nullable = false, updatable = false)
    private UUID doctorId;

    @Column(name = "patient_id", nullable = false, updatable = false)
    private UUID patientId;

    @Column(name = "visit_date", nullable = false)
    private Instant visitDate = Instant.now();

    @Column(name = "diagnosis_code", nullable = false)
    private String diagnosisCode;

    @Column(name = "diagnosis_name", nullable = false)
    private String diagnosisName;

    /** Chẩn đoán phụ — nhiều mã ICD-10 (snapshot code+name), lưu jsonb. Có thể rỗng. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "secondary_diagnoses", nullable = false)
    private List<Diagnosis> secondaryDiagnoses = new ArrayList<>();

    private String note;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
        if (visitDate == null) visitDate = Instant.now();
    }
}
