package com.clinic.order;

import java.util.Map;
import java.util.Set;

public enum OrderStatus {
    PENDING,    // vừa đặt, chờ xác nhận
    CONFIRMED,  // bác sĩ đã xác nhận
    READY,      // đã soạn thuốc, chờ đến lấy
    COMPLETED,  // đã nhận và thanh toán tại quầy
    CANCELLED;

    /** Các bước chuyển hợp lệ — chặn nhảy cóc kiểu PENDING → COMPLETED. */
    private static final Map<OrderStatus, Set<OrderStatus>> TRANSITIONS = Map.of(
        PENDING, Set.of(CONFIRMED, CANCELLED),
        CONFIRMED, Set.of(READY, CANCELLED),
        READY, Set.of(COMPLETED, CANCELLED),
        COMPLETED, Set.of(),
        CANCELLED, Set.of()
    );

    public boolean canTransitionTo(OrderStatus next) {
        return TRANSITIONS.get(this).contains(next);
    }
}
