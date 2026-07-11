package com.clinic.appointment;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AppointmentRepository extends JpaRepository<Appointment, UUID> {

    List<Appointment> findByProfileIdOrderBySlotStartDesc(UUID profileId);

    Optional<Appointment> findByIdAndProfileId(UUID id, UUID profileId);

    List<Appointment> findBySlotStartBetweenOrderBySlotStart(Instant from, Instant to);

    List<Appointment> findBySlotStartBetweenAndStatusInOrderBySlotStart(
        Instant from, Instant to, List<AppointmentStatus> statuses);

    /** Có lịch active nào giao với khoảng [start, end) không — check sớm cho UX. */
    boolean existsBySlotStartLessThanAndSlotEndGreaterThanAndStatusIn(
        Instant end, Instant start, List<AppointmentStatus> statuses);
}
