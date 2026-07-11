package com.clinic.patient;

import com.clinic.patient.PatientService.PatientDto;
import com.clinic.patient.PatientService.UpsertRequest;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/doctor/patients")
@RequiredArgsConstructor
public class DoctorPatientController {

    private final PatientService patientService;

    private static UUID doctorId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }

    @GetMapping
    public Page<PatientDto> search(
        @AuthenticationPrincipal Jwt jwt,
        @RequestParam(defaultValue = "") String q,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        return patientService.search(doctorId(jwt), q, page, size);
    }

    @GetMapping("/{id}")
    public PatientDto get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return patientService.get(doctorId(jwt), id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PatientDto create(@AuthenticationPrincipal Jwt jwt, @RequestBody UpsertRequest req) {
        return patientService.create(doctorId(jwt), req);
    }

    @PutMapping("/{id}")
    public PatientDto update(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                             @RequestBody UpsertRequest req) {
        return patientService.update(doctorId(jwt), id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        patientService.softDelete(doctorId(jwt), id);
    }
}
