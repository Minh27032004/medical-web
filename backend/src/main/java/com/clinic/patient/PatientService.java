package com.clinic.patient;

import com.clinic.common.ApiException;
import com.clinic.common.Pageables;
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

    /**
     * Search theo tên HOẶC SĐT — LUÔN kèm doctorId (cô lập dữ liệu).
     *
     * Tên KHÔNG PHÂN BIỆT DẤU: bác sĩ gõ "nguyen van dung" phải ra "Nguyễn Văn Dũng".
     * Gõ đủ dấu tên bệnh nhân trong lúc khám là việc không ai muốn làm.
     * Native query vì JPQL không có unaccent (cùng cách V5 làm cho ICD-10).
     * SĐT thì so thẳng, không cần unaccent.
     */
    @Query(value = """
        select * from patients p
        where p.doctor_id = :doctorId and p.deleted_at is null
          and (extensions.unaccent(lower(p.full_name))
                 like extensions.unaccent(lower('%' || :q || '%'))
               or p.phone like '%' || :q || '%')
        order by p.created_at desc
        """,
        countQuery = """
        select count(*) from patients p
        where p.doctor_id = :doctorId and p.deleted_at is null
          and (extensions.unaccent(lower(p.full_name))
                 like extensions.unaccent(lower('%' || :q || '%'))
               or p.phone like '%' || :q || '%')
        """,
        nativeQuery = true)
    Page<Patient> search(@Param("doctorId") UUID doctorId, @Param("q") String q, Pageable pageable);

    Optional<Patient> findByIdAndDoctorIdAndDeletedAtIsNull(UUID id, UUID doctorId);

    /** KỂ CẢ đã xóa mềm — chỉ dùng cho việc đọc lại hồ sơ lần khám cũ. */
    Optional<Patient> findByIdAndDoctorId(UUID id, UUID doctorId);

    /** Id các bệnh nhân (chưa xóa) trùng CẢ tên (không phân biệt hoa/thường, bỏ khoảng thừa) LẪN SĐT. */
    @Query("""
        select p.id from Patient p
        where p.doctorId = :doctorId and p.deletedAt is null
          and lower(trim(p.fullName)) = lower(trim(:fullName))
          and trim(p.phone) = trim(:phone)
        """)
    java.util.List<UUID> findDuplicateIds(@Param("doctorId") UUID doctorId,
                                          @Param("fullName") String fullName,
                                          @Param("phone") String phone);
}

@Service
@RequiredArgsConstructor
public class PatientService {

    private final PatientRepository repository;

    public record UpsertRequest(
        String fullName, String phone, String gender, Integer age, String address,
        boolean hasDrugAllergy, String drugAllergyNote,
        boolean hasChronicCondition, String chronicConditionNote
    ) {}

    public record PatientDto(
        UUID id, String fullName, String phone, String gender, Integer age, String address,
        boolean hasDrugAllergy, String drugAllergyNote,
        boolean hasChronicCondition, String chronicConditionNote, Instant createdAt
    ) {}

    @Transactional(readOnly = true)
    public Page<PatientDto> search(UUID doctorId, String q, int page, int size) {
        var query = q == null ? "" : q.trim();
        return repository.search(doctorId, query, Pageables.of(page, size, 100))
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
        checkDuplicate(doctorId, p.getFullName(), p.getPhone(), null);
        return toDto(repository.save(p));
    }

    @Transactional
    public PatientDto update(UUID doctorId, UUID id, UpsertRequest req) {
        var p = findOwned(doctorId, id);
        apply(p, req);
        checkDuplicate(doctorId, p.getFullName(), p.getPhone(), id); // loại trừ chính mình
        return toDto(repository.save(p));
    }

    /**
     * Chống trùng "cùng người đăng ký lại": chặn khi TÊN + SĐT đều trùng một bệnh nhân khác.
     * KHÔNG chặn theo tên đơn thuần — trùng tên nhưng khác SĐT là hai người khác nhau, vẫn cho tạo.
     * Bỏ qua khi chưa nhập SĐT (không đủ định danh để khẳng định là trùng).
     */
    private void checkDuplicate(UUID doctorId, String fullName, String phone, UUID excludeId) {
        if (phone == null || phone.isBlank()) return;
        boolean dup = repository.findDuplicateIds(doctorId, fullName, phone).stream()
            .anyMatch(existing -> !existing.equals(excludeId));
        if (dup) {
            throw ApiException.conflict(
                "Đã có bệnh nhân trùng tên và số điện thoại. Kiểm tra lại, hoặc nhập SĐT khác nếu là người khác.");
        }
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

    /**
     * Như findOwned nhưng CHẤP NHẬN bệnh nhân đã xóa mềm — dùng khi mở lại lần khám cũ:
     * xóa bệnh nhân vẫn giữ lịch sử khám, nên hồ sơ cũ phải đọc được tên/tuổi để in đơn.
     */
    public Patient findOwnedEvenDeleted(UUID doctorId, UUID id) {
        return repository.findByIdAndDoctorId(id, doctorId)
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
        // Tuổi tùy chọn; chặn số vô lý ngay ở service (DB cũng có check 0..150 — V13).
        if (req.age() != null && (req.age() < 0 || req.age() > 150)) {
            throw ApiException.badRequest("Tuổi phải trong khoảng 0 - 150");
        }
        p.setAge(req.age());
        // Địa chỉ đã bỏ khỏi form (thay bằng tuổi). Chỉ ghi đè khi request thực sự gửi lên,
        // để dữ liệu địa chỉ cũ của bệnh nhân không bị xóa trắng mỗi lần sửa hồ sơ.
        if (req.address() != null) {
            p.setAddress(req.address());
        }
        p.setHasDrugAllergy(req.hasDrugAllergy());
        p.setDrugAllergyNote(req.hasDrugAllergy() ? req.drugAllergyNote() : null);
        p.setHasChronicCondition(req.hasChronicCondition());
        p.setChronicConditionNote(req.hasChronicCondition() ? req.chronicConditionNote() : null);
    }

    private static PatientDto toDto(Patient p) {
        return new PatientDto(p.getId(), p.getFullName(), p.getPhone(), p.getGender(),
            p.getAge(), p.getAddress(), p.isHasDrugAllergy(), p.getDrugAllergyNote(),
            p.isHasChronicCondition(), p.getChronicConditionNote(), p.getCreatedAt());
    }
}
