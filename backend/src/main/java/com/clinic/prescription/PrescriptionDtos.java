package com.clinic.prescription;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public class PrescriptionDtos {

    private PrescriptionDtos() {}

    public record ItemRequest(
        UUID medicineId, // null = thuốc ngoài kho, khi đó phải tự nhập giá
        @NotBlank(message = "Thiếu tên thuốc") String medicineName,
        @Min(1) int quantity,
        String dosage,
        BigDecimal costPrice,
        BigDecimal salePrice
    ) {}

    public record ImageRequest(@NotBlank String imagePath, String kind) {}

    public record CreateRequest(
        @NotNull UUID patientId,
        UUID appointmentId,
        String symptoms,
        String diagnosis,
        @NotNull @PositiveOrZero BigDecimal examFee,
        @NotEmpty(message = "Đơn thuốc cần ít nhất 1 thuốc") @Valid List<ItemRequest> items,
        @Valid List<ImageRequest> images
    ) {}

    public record ItemDto(
        String medicineName,
        int quantity,
        String dosage,
        BigDecimal costPrice, // ẩn với Patient (set null)
        BigDecimal salePrice
    ) {}

    public record ImageDto(UUID id, String kind, String url) {}

    public record PrescriptionDto(
        UUID id,
        UUID patientId,
        String patientName,
        String symptoms,
        String diagnosis,
        BigDecimal examFee,
        BigDecimal medicineTotal,  // tổng tiền thuốc (giá bán)
        BigDecimal costTotal,      // tổng giá gốc — chỉ Doctor (null với Patient)
        Instant createdAt,
        List<ItemDto> items,
        List<ImageDto> images
    ) {}
}
