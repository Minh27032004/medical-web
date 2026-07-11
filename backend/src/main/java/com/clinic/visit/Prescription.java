package com.clinic.visit;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;

/** Đơn thuốc — 1:1 với lần khám (§4.4). */
@Entity
@Table(name = "prescriptions")
@Getter
@Setter
@NoArgsConstructor
public class Prescription {

    @Id
    @GeneratedValue
    @UuidGenerator
    private UUID id;

    @Column(name = "doctor_id", nullable = false, updatable = false)
    private UUID doctorId;

    @Column(name = "visit_id", nullable = false, unique = true, updatable = false)
    private UUID visitId;

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "prescription_id", nullable = false)
    private List<PrescriptionItem> items = new ArrayList<>();

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "printed_at")
    private Instant printedAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
    }
}
