package com.clinic.revenue;

import com.clinic.revenue.RevenueService.Summary;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/doctor/revenue")
@RequiredArgsConstructor
public class RevenueController {

    private final RevenueService revenueService;

    @GetMapping
    public Summary summary(
        @RequestParam(defaultValue = "day") String period,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        return revenueService.summarize(period,
            date != null ? date : LocalDate.now(com.clinic.appointment.AppointmentService.CLINIC_ZONE));
    }
}
