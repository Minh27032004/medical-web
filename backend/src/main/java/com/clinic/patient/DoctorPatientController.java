package com.clinic.patient;

import com.clinic.patient.PatientDtos.PatientDto;
import com.clinic.patient.PatientDtos.UpsertRequest;
import com.clinic.prescription.PrescriptionDtos.PrescriptionDto;
import com.clinic.prescription.PrescriptionService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
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
    private final PrescriptionService prescriptionService;

    @GetMapping
    public Page<PatientDto> search(
        @RequestParam(defaultValue = "") String q,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        return patientService.search(q, page, size);
    }

    @GetMapping("/{id}")
    public PatientDto get(@PathVariable UUID id) {
        return patientService.get(id);
    }

    /** Lịch sử khám của một bệnh nhân. */
    @GetMapping("/{id}/prescriptions")
    public List<PrescriptionDto> prescriptions(@PathVariable UUID id) {
        return prescriptionService.listByPatient(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PatientDto create(@Valid @RequestBody UpsertRequest req) {
        return patientService.create(req);
    }

    @PutMapping("/{id}")
    public PatientDto update(@PathVariable UUID id, @Valid @RequestBody UpsertRequest req) {
        return patientService.update(id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        patientService.softDelete(id);
    }
}
