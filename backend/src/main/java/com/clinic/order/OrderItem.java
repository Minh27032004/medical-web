package com.clinic.order;

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

/** Mỗi dòng lưu SNAPSHOT tên + giá tại thời điểm đặt (D11). */
@Entity
@Table(name = "order_items")
@Getter
@Setter
@NoArgsConstructor
public class OrderItem {

    @Id
    @GeneratedValue
    @UuidGenerator
    private UUID id;

    @Column(name = "medicine_id")
    private UUID medicineId;

    @Column(name = "medicine_name", nullable = false)
    private String medicineName;

    @Column(nullable = false)
    private int quantity;

    @Column(name = "cost_price", nullable = false)
    private BigDecimal costPrice;

    @Column(name = "sale_price", nullable = false)
    private BigDecimal salePrice;
}
