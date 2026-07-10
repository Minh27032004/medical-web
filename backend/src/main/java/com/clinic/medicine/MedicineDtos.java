package com.clinic.medicine;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public class MedicineDtos {

    private MedicineDtos() {}

    /** Cho Customer/Patient — KHÔNG bao giờ lộ costPrice (giá gốc là dữ liệu kinh doanh). */
    public record PublicItem(
        UUID id,
        String name,
        String description,
        String imageUrl,
        BigDecimal salePrice,
        LocalDate expiryDate
    ) {}

    /** Cho Doctor — đầy đủ cả giá gốc và trạng thái. */
    public record DoctorItem(
        UUID id,
        String name,
        String description,
        String imagePath,
        String imageUrl,
        BigDecimal costPrice,
        BigDecimal salePrice,
        LocalDate expiryDate,
        boolean inStock
    ) {}

    /** Gợi ý autocomplete (ảnh + tên) khi kê đơn. */
    public record Suggestion(
        UUID id,
        String name,
        String imageUrl,
        BigDecimal salePrice
    ) {}

    public record UpsertRequest(
        @NotBlank(message = "Tên thuốc không được để trống") String name,
        String description,
        String imagePath,
        @NotNull(message = "Thiếu giá gốc") @PositiveOrZero(message = "Giá gốc phải >= 0")
        BigDecimal costPrice,
        @NotNull(message = "Thiếu giá bán") @PositiveOrZero(message = "Giá bán phải >= 0")
        BigDecimal salePrice,
        LocalDate expiryDate,
        Boolean inStock
    ) {}
}
