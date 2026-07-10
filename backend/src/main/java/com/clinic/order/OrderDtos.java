package com.clinic.order;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public class OrderDtos {

    private OrderDtos() {}

    public record CreateItem(@NotNull UUID medicineId, @Min(1) int quantity) {}

    public record CreateRequest(@NotEmpty(message = "Giỏ hàng trống") @Valid List<CreateItem> items) {}

    /** Patient chỉ thấy giá bán. */
    public record PatientItem(String medicineName, int quantity, BigDecimal salePrice) {}

    public record PatientOrder(
        UUID id,
        String pickupCode,
        OrderStatus status,
        BigDecimal totalAmount,
        Instant createdAt,
        List<PatientItem> items
    ) {}

    /** Doctor thấy thêm giá gốc và người mua. */
    public record DoctorItem(String medicineName, int quantity, BigDecimal costPrice, BigDecimal salePrice) {}

    public record DoctorOrder(
        UUID id,
        String pickupCode,
        OrderStatus status,
        BigDecimal totalAmount,
        Instant createdAt,
        String buyerName,
        String buyerPhone,
        List<DoctorItem> items
    ) {}

    public record UpdateStatusRequest(@NotNull OrderStatus status) {}
}
