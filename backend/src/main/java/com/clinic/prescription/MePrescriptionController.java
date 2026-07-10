package com.clinic.prescription;

import com.clinic.prescription.PrescriptionDtos.PrescriptionDto;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/me/prescriptions")
@RequiredArgsConstructor
public class MePrescriptionController {

    private final PrescriptionService prescriptionService;

    /** Đơn thuốc của chính mình (qua patients.profile_id) — không thấy giá gốc. */
    @GetMapping
    public List<PrescriptionDto> mine(@AuthenticationPrincipal Jwt jwt) {
        return prescriptionService.listForProfile(UUID.fromString(jwt.getSubject()));
    }
}
