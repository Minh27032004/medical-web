package com.clinic.patient;

import com.clinic.common.ApiException;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

interface PatientRepository extends JpaRepository<Patient, UUID> {

    /** Search theo tên HOẶC SĐT — LUÔN kèm doctorId (cô lập dữ liệu). */
    @Query("""
        select p from Patient p
        where p.doctorId = :doctorId and p.deletedAt is null
          and (lower(p.fullName) like lower(concat('%', :q, '%'))
               or p.phone like concat('%', :q, '%'))
        order by p.createdAt desc
        """)
    Page<Patient> search(@Param("doctorId") UUID doctorId, @Param("q") String q, Pageable pageable);

    Optional<Patient> findByIdAndDoctorIdAndDeletedAtIsNull(UUID id, UUID doctorId);
}

@Service
@RequiredArgsConstructor
public class PatientService {

    private final PatientRepository repository;

    public record UpsertRequest(
        String fullName, String phone, String gender, String address,
        boolean hasDrugAllergy, String drugAllergyNote,
        boolean hasChronicCondition, String chronicConditionNote
    ) {}

    public record PatientDto(
        UUID id, String fullName, String phone, String gender, String address,
        boolean hasDrugAllergy, String drugAllergyNote,
        boolean hasChronicCondition, String chronicConditionNote, Instant createdAt
    ) {}

    @Transactional(readOnly = true)
    public Page<PatientDto> search(UUID doctorId, String q, int page, int size) {
        var query = q == null ? "" : q.trim();
        return repository.search(doctorId, query, PageRequest.of(page, Math.min(size, 100)))
            .map(PatientService::toDto);
    }

    @Transactional(readOnly = true)
    public PatientDto get(UUID doctorId, UUID id) {
        return toDto(findOwned(doctorId, id));
    }

    @Transactional
    public PatientDto create(UUID doctorId, UpsertRequest req) {
        var p = new Patient();
        p.setDoctorId(doctorId);
        apply(p, req);
        return toDto(repository.save(p));
    }

    @Transactional
    public PatientDto update(UUID doctorId, UUID id, UpsertRequest req) {
        var p = findOwned(doctorId, id);
        apply(p, req);
        return toDto(repository.save(p));
    }

    @Transactional
    public void softDelete(UUID doctorId, UUID id) {
        var p = findOwned(doctorId, id);
        p.setDeletedAt(Instant.now());
        repository.save(p);
    }

    public Patient findOwned(UUID doctorId, UUID id) {
        return repository.findByIdAndDoctorIdAndDeletedAtIsNull(id, doctorId)
            .orElseThrow(() -> ApiException.notFound("Không tìm thấy bệnh nhân"));
    }

    /** Tra bệnh nhân theo tên/SĐT (trả entity) — dùng cho trợ lý chat resolve "anh A". */
    @Transactional(readOnly = true)
    public java.util.List<Patient> searchEntities(UUID doctorId, String q, int limit) {
        return repository.search(doctorId, q == null ? "" : q.trim(),
            PageRequest.of(0, Math.max(1, limit))).getContent();
    }

    /** Map id→Patient cho danh sách — CHỈ trả về bệnh nhân của doctor này. */
    @Transactional(readOnly = true)
    public java.util.Map<UUID, Patient> mapByIds(UUID doctorId, java.util.Collection<UUID> ids) {
        return repository.findAllById(ids).stream()
            .filter(p -> doctorId.equals(p.getDoctorId()))
            .collect(java.util.stream.Collectors.toMap(Patient::getId, p -> p));
    }

    private void apply(Patient p, UpsertRequest req) {
        if (req.fullName() == null || req.fullName().isBlank()) {
            throw ApiException.badRequest("Thiếu tên bệnh nhân");
        }
        p.setFullName(req.fullName().trim());
        p.setPhone(req.phone());
        p.setGender(req.gender());
        p.setAddress(req.address());
        p.setHasDrugAllergy(req.hasDrugAllergy());
        p.setDrugAllergyNote(req.hasDrugAllergy() ? req.drugAllergyNote() : null);
        p.setHasChronicCondition(req.hasChronicCondition());
        p.setChronicConditionNote(req.hasChronicCondition() ? req.chronicConditionNote() : null);
    }

    private static PatientDto toDto(Patient p) {
        return new PatientDto(p.getId(), p.getFullName(), p.getPhone(), p.getGender(),
            p.getAddress(), p.isHasDrugAllergy(), p.getDrugAllergyNote(),
            p.isHasChronicCondition(), p.getChronicConditionNote(), p.getCreatedAt());
    }
}
