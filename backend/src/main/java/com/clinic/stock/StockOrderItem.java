package com.clinic.stock;

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

/** Dòng đơn nhập kho — tên/đơn vị là SNAPSHOT, số lượng theo đơn vị bác sĩ đặt. */
@Entity
@Table(name = "stock_order_items")
@Getter
@Setter
@NoArgsConstructor
public class StockOrderItem {

    @Id
    @GeneratedValue
    @UuidGenerator
    private UUID id;

    /** Null khi thuốc đã bị xóa khỏi kho — đơn cũ vẫn đọc được nhờ snapshot tên. */
    @Column(name = "medicine_id")
    private UUID medicineId;

    @Column(name = "medicine_name", nullable = false)
    private String medicineName;

    @Column(name = "unit_name", nullable = false)
    private String unitName;

    @Column(name = "unit_label", nullable = false)
    private String unitLabel;

    @Column(nullable = false)
    private BigDecimal qty;
}
