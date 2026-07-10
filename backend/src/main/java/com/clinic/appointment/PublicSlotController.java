package com.clinic.appointment;

import com.clinic.appointment.AppointmentDtos.Slot;
import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Xem khung giờ trống không cần đăng nhập — nhưng muốn ĐẶT thì phải là Patient. */
@RestController
@RequestMapping("/api/public/appointments")
@RequiredArgsConstructor
public class PublicSlotController {

    private final AppointmentService appointmentService;

    @GetMapping("/slots")
    public List<Slot> slots(
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        return appointmentService.slotsForDate(date);
    }
}
