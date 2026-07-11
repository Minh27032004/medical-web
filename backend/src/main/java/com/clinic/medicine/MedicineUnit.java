package com.clinic.medicine;

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

/** Đơn vị áp dụng cho 1 thuốc + tỷ lệ quy về đơn vị nhỏ nhất (§4.7, §6.1). */
@Entity
@Table(name = "medicine_units")
@Getter
@Setter
@NoArgsConstructor
public class MedicineUnit {

    @Id
    @GeneratedValue
    @UuidGenerator
    private UUID id;

    /** chai | hop | vi | vien | goi | ong */
    @Column(name = "unit_name", nullable = false)
    private String unitName;

    /** Lớn→nhỏ: chai=1, hộp=2, vĩ=3, viên=4, gói=5; ống=9 (dùng riêng). */
    @Column(name = "level_order", nullable = false)
    private int levelOrder;

    /** Số đơn vị nhỏ nhất trong 1 đơn vị này (base = 1). */
    @Column(name = "factor_to_base", nullable = false)
    private BigDecimal factorToBase;
}
