package com.clinic.medicine;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.BatchSize;
import org.hibernate.annotations.UuidGenerator;

/** Thuốc trong kho — MỖI bác sĩ một kho riêng. Tồn LUÔN lưu theo đơn vị nhỏ nhất (D16). */
@Entity
@Table(name = "medicines")
@Getter
@Setter
@NoArgsConstructor
public class Medicine {

    @Id
    @GeneratedValue
    @UuidGenerator
    private UUID id;

    @Column(name = "doctor_id", nullable = false, updatable = false)
    private UUID doctorId;

    @Column(nullable = false)
    private String name;

    /** Thuốc tiêm → chỉ có đơn vị 'ong'. */
    @Column(name = "is_injection", nullable = false)
    private boolean injection = false;

    /** Truyền dịch → chỉ có đơn vị 'chai' (V11). Loại trừ lẫn nhau với injection. */
    @Column(name = "is_infusion", nullable = false)
    private boolean infusion = false;

    @Column(name = "base_unit", nullable = false)
    private String baseUnit;

    /** Ảnh minh họa — path trong bucket public medicine-images. */
    @Column(name = "image_path")
    private String imagePath;

    /** Có thể ÂM (D16) — sổ sách lệch không được chặn kê đơn. */
    @Column(name = "stock_base_qty", nullable = false)
    private BigDecimal stockBaseQty = BigDecimal.ZERO;

    @Column(name = "low_stock_threshold", nullable = false)
    private int lowStockThreshold = 30;

    /**
     * @BatchSize: nạp units của NHIỀU thuốc bằng một câu IN thay vì mỗi thuốc một query.
     * Gần như mọi màn hình đều đọc units (stockDisplay quy tồn ngược lên đơn vị lớn), nên
     * thiếu nó là trang kho 181 thuốc bắn 182 query — đã đo. Không dựa vào
     * default_batch_fetch_size toàn cục nữa: ai chỉnh giá trị đó sẽ không ngờ tới hệ quả này.
     */
    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "medicine_id", nullable = false)
    @OrderBy("levelOrder asc")
    @BatchSize(size = 100)
    private List<MedicineUnit> units = new ArrayList<>();

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
