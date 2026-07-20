package com.clinic.stock;

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

/** Đơn nhập kho (V14) — PENDING không đụng tồn; RECEIVED mới cộng vào kho. */
@Entity
@Table(name = "stock_orders")
@Getter
@Setter
@NoArgsConstructor
public class StockOrder {

    public static final String PENDING = "PENDING";
    public static final String RECEIVED = "RECEIVED";
    public static final String CANCELLED = "CANCELLED";

    @Id
    @GeneratedValue
    @UuidGenerator
    private UUID id;

    @Column(name = "doctor_id", nullable = false, updatable = false)
    private UUID doctorId;

    @Column(nullable = false, updatable = false)
    private String code;

    @Column(nullable = false)
    private String status = PENDING;

    /** QUICK = dựng từ danh sách thuốc sắp hết; MANUAL = bác sĩ tự chọn. */
    @Column(nullable = false, updatable = false)
    private String source;

    private String note;

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "order_id", nullable = false)
    private List<StockOrderItem> items = new ArrayList<>();

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "received_at")
    private Instant receivedAt;

    @Column(name = "cancelled_at")
    private Instant cancelledAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
    }
}
