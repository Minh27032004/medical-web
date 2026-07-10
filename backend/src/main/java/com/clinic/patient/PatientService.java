package com.clinic.patient;

import com.clinic.common.ApiException;
import com.clinic.patient.PatientDtos.PatientDto;
import com.clinic.patient.PatientDtos.UpsertRequest;
import com.clinic.storage.SupabaseStorageService;
import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PatientService {

    private static final int SIGNED_URL_TTL_SECONDS = 3600;

    private final PatientRepository patientRepository;
    private final SupabaseStorageService storage;

    private static String sanitize(String q) {
        return q == null ? "" : q.trim();
    }

    @Transactional(readOnly = true)
    public Page<PatientDto> search(String q, int page, int size) {
        return patientRepository.search(sanitize(q), PageRequest.of(page, Math.min(size, 100)))
            .map(this::toDto);
    }

    @Transactional(readOnly = true)
    public PatientDto get(UUID id) {
        return toDto(find(id));
    }

    @Transactional
    public PatientDto create(UpsertRequest req) {
        var p = new Patient();
        apply(p, req);
        return toDto(patientRepository.save(p));
    }

    @Transactional
    public PatientDto update(UUID id, UpsertRequest req) {
        var p = find(id);
        apply(p, req);
        return toDto(patientRepository.save(p));
    }

    @Transactional
    public void softDelete(UUID id) {
        var p = find(id);
        p.setDeletedAt(Instant.now());
        patientRepository.save(p);
    }

    private Patient find(UUID id) {
        return patientRepository.findByIdAndDeletedAtIsNull(id)
            .orElseThrow(() -> ApiException.notFound("Không tìm thấy hồ sơ bệnh nhân"));
    }

    private void apply(Patient p, UpsertRequest req) {
        p.setFullName(req.fullName().trim());
        p.setPhone(req.phone());
        p.setAge(req.age());
        // null = giữ ảnh cũ (form không gửi lại path khi không đổi ảnh)
        if (req.photoPath() != null) p.setPhotoPath(req.photoPath());
        p.setNote(req.note());
        if (req.profileId() != null) p.setProfileId(req.profileId());
    }

    private PatientDto toDto(Patient p) {
        return new PatientDto(p.getId(), p.getFullName(), p.getPhone(), p.getAge(),
            storage.signedUrl(p.getPhotoPath(), SIGNED_URL_TTL_SECONDS),
            p.getNote(), p.getProfileId(), p.getCreatedAt());
    }
}
