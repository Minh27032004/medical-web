package com.clinic.visit;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;

/** Dòng thuốc trong đơn (§4.5) — SNAPSHOT tên/đơn vị/liều, đơn cũ bất biến. */
@Entity
@Table(name = "prescription_items")
@Getter
@Setter
@NoArgsConstructor
public class PrescriptionItem {

    @Id
    @GeneratedValue
    @UuidGenerator
    private UUID id;

    /** Tham chiếu kho để trừ tồn — null = thuốc ngoài kho. */
    @Column(name = "medicine_id")
    private UUID medicineId;

    @Column(name = "medicine_name", nullable = false)
    private String medicineName;

    @Column(name = "base_unit", nullable = false)
    private String baseUnit;

    @Column(name = "dose_morning", nullable = false)
    private BigDecimal doseMorning = BigDecimal.ZERO;

    @Column(name = "dose_noon", nullable = false)
    private BigDecimal doseNoon = BigDecimal.ZERO;

    @Column(name = "dose_afternoon", nullable = false)
    private BigDecimal doseAfternoon = BigDecimal.ZERO;

    @Column(name = "dose_evening", nullable = false)
    private BigDecimal doseEvening = BigDecimal.ZERO;

    @Column(name = "special_dose_text")
    private String specialDoseText;

    @Column(name = "usage_note")
    private String usageNote;

    @Column(name = "num_days")
    private Integer numDays;

    @Column(name = "total_quantity_base", nullable = false)
    private BigDecimal totalQuantityBase = BigDecimal.ZERO;

    @Column(name = "is_injection", nullable = false)
    private boolean injection = false;

    @Column(name = "is_infusion", nullable = false)
    private boolean infusion = false;
}
