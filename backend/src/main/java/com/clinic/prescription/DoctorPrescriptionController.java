package com.clinic.prescription;

import com.clinic.prescription.PrescriptionDtos.CreateRequest;
import com.clinic.prescription.PrescriptionDtos.PrescriptionDto;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/doctor/prescriptions")
@RequiredArgsConstructor
public class DoctorPrescriptionController {

    private final PrescriptionService prescriptionService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PrescriptionDto create(@Valid @RequestBody CreateRequest req) {
        return prescriptionService.create(req);
    }

    /** Lịch sử khám theo ngày — dùng cho trang lịch sử + doanh thu. */
    @GetMapping
    public List<PrescriptionDto> byDate(
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        return prescriptionService.listByDate(date);
    }
}
