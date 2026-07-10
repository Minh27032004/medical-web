package com.clinic.appointment;

import com.clinic.appointment.AppointmentDtos.AvailabilityRow;
import com.clinic.appointment.AppointmentDtos.DoctorAppointment;
import com.clinic.appointment.AppointmentDtos.UpdateStatusRequest;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/doctor")
@RequiredArgsConstructor
public class DoctorAppointmentController {

    private final AppointmentService appointmentService;

    @GetMapping("/appointments")
    public List<DoctorAppointment> byDate(
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        return appointmentService.listForDoctor(date);
    }

    @PatchMapping("/appointments/{id}/status")
    public void updateStatus(@PathVariable UUID id, @Valid @RequestBody UpdateStatusRequest req) {
        appointmentService.updateStatus(id, req.status());
    }

    @GetMapping("/schedule")
    public List<AvailabilityRow> getSchedule() {
        return appointmentService.getSchedule();
    }

    @PutMapping("/schedule")
    public List<AvailabilityRow> replaceSchedule(@RequestBody List<@Valid AvailabilityRow> rows) {
        return appointmentService.replaceSchedule(rows);
    }
}
