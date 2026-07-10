package com.clinic.appointment;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

public class AppointmentDtos {

    private AppointmentDtos() {}

    public record Slot(Instant start, Instant end, boolean available) {}

    public record BookRequest(@NotNull Instant slotStart, String note) {}

    public record DocumentDto(UUID id, String url) {}

    public record PatientAppointment(
        UUID id,
        Instant slotStart,
        Instant slotEnd,
        AppointmentStatus status,
        String note,
        List<DocumentDto> documents
    ) {}

    public record DoctorAppointment(
        UUID id,
        Instant slotStart,
        Instant slotEnd,
        AppointmentStatus status,
        String note,
        String patientName,
        String patientPhone,
        List<DocumentDto> documents
    ) {}

    public record AvailabilityRow(
        @Min(0) @Max(6) int weekday,
        @NotNull LocalTime startTime,
        @NotNull LocalTime endTime,
        @Min(5) int slotMinutes
    ) {}

    public record UpdateStatusRequest(@NotNull AppointmentStatus status) {}
}
