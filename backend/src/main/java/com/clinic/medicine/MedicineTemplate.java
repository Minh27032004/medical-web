package com.clinic.medicine;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;

/** Thuốc mẫu — "thuốc hay cộng liều" của từng bác sĩ (§4.8). */
@Entity
@Table(name = "medicine_templates")
@Getter
@Setter
@NoArgsConstructor
public class MedicineTemplate {

    @Id
    @GeneratedValue
    @UuidGenerator
    private UUID id;

    @Column(name = "doctor_id", nullable = false, updatable = false)
    private UUID doctorId;

    /** Liên kết thuốc trong kho để trừ tồn đúng — có thể null. */
    @Column(name = "medicine_id")
    private UUID medicineId;

    @Column(nullable = false)
    private String name;

    @Column(name = "default_dose_morning", nullable = false)
    private BigDecimal defaultDoseMorning = BigDecimal.ZERO;

    @Column(name = "default_dose_noon", nullable = false)
    private BigDecimal defaultDoseNoon = BigDecimal.ZERO;

    @Column(name = "default_dose_afternoon", nullable = false)
    private BigDecimal defaultDoseAfternoon = BigDecimal.ZERO;

    @Column(name = "default_dose_evening", nullable = false)
    private BigDecimal defaultDoseEvening = BigDecimal.ZERO;

    @Column(name = "default_usage_note")
    private String defaultUsageNote;

    @Column(name = "default_num_days")
    private Integer defaultNumDays;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
    }
}
