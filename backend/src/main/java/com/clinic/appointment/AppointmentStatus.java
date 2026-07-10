package com.clinic.appointment;

import java.util.Map;
import java.util.Set;

public enum AppointmentStatus {
    BOOKED,     // bệnh nhân vừa đặt
    CONFIRMED,  // bác sĩ xác nhận
    DONE,       // đã khám
    CANCELLED;

    private static final Map<AppointmentStatus, Set<AppointmentStatus>> TRANSITIONS = Map.of(
        BOOKED, Set.of(CONFIRMED, DONE, CANCELLED),
        CONFIRMED, Set.of(DONE, CANCELLED),
        DONE, Set.of(),
        CANCELLED, Set.of()
    );

    public boolean canTransitionTo(AppointmentStatus next) {
        return TRANSITIONS.get(this).contains(next);
    }

    public boolean isActive() {
        return this == BOOKED || this == CONFIRMED;
    }
}
