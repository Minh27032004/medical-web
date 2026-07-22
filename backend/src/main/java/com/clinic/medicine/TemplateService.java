package com.clinic.medicine;

import com.clinic.common.ApiException;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

interface MedicineTemplateRepository extends JpaRepository<MedicineTemplate, UUID> {

    /** Tên thuốc mẫu do bác sĩ tự đặt, hay có dấu → tìm không phân biệt dấu như thuốc kho. */
    @Query(value = """
        select * from medicine_templates t
        where t.doctor_id = :doctorId and t.deleted_at is null
          and extensions.unaccent(lower(t.name)) like extensions.unaccent(lower('%' || :q || '%'))
        order by t.name
        """, nativeQuery = true)
    List<MedicineTemplate> search(@Param("doctorId") UUID doctorId, @Param("q") String q, Pageable pageable);

    Optional<MedicineTemplate> findByIdAndDoctorIdAndDeletedAtIsNull(UUID id, UUID doctorId);

    /** Toàn bộ thuốc mẫu còn sống của bác sĩ — cho /suggest/all tải sẵn về client. */
    List<MedicineTemplate> findByDoctorIdAndDeletedAtIsNullOrderByName(UUID doctorId);
}

@Service
@RequiredArgsConstructor
public class TemplateService {

    private final MedicineTemplateRepository repository;
    private final MedicineService medicineService;

    public record UpsertRequest(String name, UUID medicineId,
                                BigDecimal doseMorning, BigDecimal doseNoon,
                                BigDecimal doseAfternoon, BigDecimal doseEvening,
                                String usageNote, Integer numDays) {}

    public record TemplateDto(UUID id, String name, UUID medicineId, String medicineName,
                              String stockDisplay, boolean injection, boolean infusion,
                              BigDecimal doseMorning, BigDecimal doseNoon,
                              BigDecimal doseAfternoon, BigDecimal doseEvening,
                              String usageNote, Integer numDays) {}

    /** Gợi ý khi kê đơn: thuốc mẫu TRƯỚC (tự điền liều), rồi tới thuốc kho (§5.4). */
    public record Suggestion(String type, UUID templateId, UUID medicineId, String name,
                             String baseUnit, String baseUnitLabel, String stockDisplay,
                             boolean injection, boolean infusion,
                             BigDecimal doseMorning, BigDecimal doseNoon,
                             BigDecimal doseAfternoon, BigDecimal doseEvening,
                             String usageNote, Integer numDays) {}

    /** Trần 500 — FE tải hết rồi lọc/phân trang client-side, trần thấp sẽ giấu mất thuốc mẫu. */
    private static final int MAX_LIST_SIZE = 500;

    @Transactional(readOnly = true)
    public List<TemplateDto> list(UUID doctorId, String q) {
        var templates = repository.search(doctorId, q == null ? "" : q.trim(),
            PageRequest.of(0, MAX_LIST_SIZE));
        var medMap = medicineService.mapByIds(doctorId, medicineIds(templates)); // 1 query thay N
        return templates.stream().map(t -> toDto(t, medMap.get(t.getMedicineId()))).toList();
    }

    private static Set<UUID> medicineIds(List<MedicineTemplate> templates) {
        return templates.stream().map(MedicineTemplate::getMedicineId)
            .filter(Objects::nonNull).collect(Collectors.toSet());
    }

    @Transactional
    public TemplateDto create(UUID doctorId, UpsertRequest req) {
        var t = new MedicineTemplate();
        t.setDoctorId(doctorId);
        apply(doctorId, t, req);
        return toDto(doctorId, repository.save(t));
    }

    @Transactional
    public TemplateDto update(UUID doctorId, UUID id, UpsertRequest req) {
        var t = repository.findByIdAndDoctorIdAndDeletedAtIsNull(id, doctorId)
            .orElseThrow(() -> ApiException.notFound("Không tìm thấy thuốc mẫu"));
        apply(doctorId, t, req);
        return toDto(doctorId, repository.save(t));
    }

    @Transactional
    public void softDelete(UUID doctorId, UUID id) {
        var t = repository.findByIdAndDoctorIdAndDeletedAtIsNull(id, doctorId)
            .orElseThrow(() -> ApiException.notFound("Không tìm thấy thuốc mẫu"));
        t.setDeletedAt(Instant.now());
        repository.save(t);
    }

    @Transactional(readOnly = true)
    public List<Suggestion> suggest(UUID doctorId, String q) {
        var query = q == null ? "" : q.trim();
        if (query.isEmpty()) return List.of();
        var out = new ArrayList<Suggestion>();

        var templates = repository.search(doctorId, query, PageRequest.of(0, 5));
        var medMap = medicineService.mapByIds(doctorId, medicineIds(templates)); // tránh N+1
        for (var t : templates) {
            out.add(toSuggestion(t, t.getMedicineId() == null ? null : medMap.get(t.getMedicineId())));
        }
        // 15 chứ không phải 8: một kho 180 thuốc có thể có tới 21 tên chứa "pa"; cắt ở 8
        // là bác sĩ không thấy thuốc mình cần dù kho có. Danh sách vẫn đủ ngắn để chọn nhanh.
        for (var m : medicineService.searchEntities(doctorId, query, 15)) {
            if (out.stream().anyMatch(s -> m.getId().equals(s.medicineId()))) continue;
            out.add(toSuggestion(m));
        }
        return out;
    }

    /**
     * Trần số gợi ý tải sẵn. Kho thực tế cỡ 180 thuốc; 2000 là chỗ thở rất rộng mà payload
     * vẫn chỉ vài trăm KB. Vượt trần thì bác sĩ mất phần đuôi danh sách chứ không phải mất
     * cả tính năng — và /suggest?q= cũ vẫn còn đó làm đường lui.
     */
    private static final int MAX_ALL = 2000;

    /**
     * TOÀN BỘ gợi ý kê đơn của một bác sĩ (thuốc mẫu trước, thuốc kho sau) — client giữ
     * sẵn rồi lọc tại chỗ khi gõ.
     *
     * Vì sao cần: suggest(q) bên trên chạy BA query cho MỖI ký tự bác sĩ gõ (tìm thuốc
     * mẫu, nạp thuốc kho của các mẫu đó, rồi tìm thuốc kho). Mỗi vòng tới Supabase tốn
     * ~200-300ms nên danh sách hiện ra sau gần một giây — với thao tác gõ liên tục thì đó
     * là cả một quãng chờ.
     *
     * Ở đây chỉ HAI query cho cả phiên làm việc, và query thứ hai (toàn bộ kho) cũng chính
     * là thứ dùng để map thuốc cho từng mẫu — nên không cần mapByIds nữa, bớt được một
     * vòng nữa so với đường cũ.
     *
     * Vẫn lọc theo doctorId lấy từ JWT ở mọi query — quy tắc số 1 của dự án.
     */
    @Transactional(readOnly = true)
    public List<Suggestion> suggestAll(UUID doctorId) {
        var templates = repository.findByDoctorIdAndDeletedAtIsNullOrderByName(doctorId);
        var medicines = medicineService.searchEntities(doctorId, "", MAX_ALL);
        var medMap = medicines.stream().collect(Collectors.toMap(Medicine::getId, m -> m));

        var out = new ArrayList<Suggestion>(templates.size() + medicines.size());
        for (var t : templates) {
            out.add(toSuggestion(t, t.getMedicineId() == null ? null : medMap.get(t.getMedicineId())));
        }
        var covered = out.stream().map(Suggestion::medicineId).filter(Objects::nonNull)
            .collect(Collectors.toSet());
        for (var m : medicines) {
            if (!covered.contains(m.getId())) out.add(toSuggestion(m));
        }
        return out;
    }

    /** Thuốc mẫu → gợi ý; medicine có thể null (mẫu chưa gắn thuốc kho). */
    private static Suggestion toSuggestion(MedicineTemplate t, Medicine m) {
        return new Suggestion("TEMPLATE", t.getId(), t.getMedicineId(), t.getName(),
            m != null ? m.getBaseUnit() : null,
            m != null ? MedicineService.UNIT_LABEL.getOrDefault(m.getBaseUnit(), m.getBaseUnit()) : null,
            m != null ? MedicineService.stockDisplay(m) : null,
            m != null && m.isInjection(), m != null && m.isInfusion(),
            t.getDefaultDoseMorning(), t.getDefaultDoseNoon(),
            t.getDefaultDoseAfternoon(), t.getDefaultDoseEvening(),
            t.getDefaultUsageNote(), t.getDefaultNumDays());
    }

    /** Thuốc kho → gợi ý (không có liều mặc định). */
    private static Suggestion toSuggestion(Medicine m) {
        return new Suggestion("MEDICINE", null, m.getId(), m.getName(),
            m.getBaseUnit(),
            MedicineService.UNIT_LABEL.getOrDefault(m.getBaseUnit(), m.getBaseUnit()),
            MedicineService.stockDisplay(m), m.isInjection(), m.isInfusion(),
            null, null, null, null, null, null);
    }

    private void apply(UUID doctorId, MedicineTemplate t, UpsertRequest req) {
        if (req.name() == null || req.name().isBlank()) {
            throw ApiException.badRequest("Thiếu tên thuốc mẫu");
        }
        if (req.medicineId() != null) {
            medicineService.findOwned(doctorId, req.medicineId()); // validate sở hữu
        }
        t.setName(req.name().trim());
        t.setMedicineId(req.medicineId());
        t.setDefaultDoseMorning(orZero(req.doseMorning()));
        t.setDefaultDoseNoon(orZero(req.doseNoon()));
        t.setDefaultDoseAfternoon(orZero(req.doseAfternoon()));
        t.setDefaultDoseEvening(orZero(req.doseEvening()));
        t.setDefaultUsageNote(req.usageNote());
        t.setDefaultNumDays(req.numDays());
    }

    private static BigDecimal orZero(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }

    private TemplateDto toDto(UUID doctorId, MedicineTemplate t) {
        return toDto(t, t.getMedicineId() == null ? null
            : medicineService.findOwnedOrNull(doctorId, t.getMedicineId()));
    }

    private static TemplateDto toDto(MedicineTemplate t, Medicine m) {
        return new TemplateDto(t.getId(), t.getName(), t.getMedicineId(),
            m != null ? m.getName() : null,
            m != null ? MedicineService.stockDisplay(m) : null,
            m != null && m.isInjection(), m != null && m.isInfusion(),
            t.getDefaultDoseMorning(), t.getDefaultDoseNoon(),
            t.getDefaultDoseAfternoon(), t.getDefaultDoseEvening(),
            t.getDefaultUsageNote(), t.getDefaultNumDays());
    }
}
