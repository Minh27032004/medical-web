package com.clinic.medicine;

import com.clinic.common.ApiException;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

interface MedicineTemplateRepository extends JpaRepository<MedicineTemplate, UUID> {

    @Query("""
        select t from MedicineTemplate t
        where t.doctorId = :doctorId and t.deletedAt is null
          and lower(t.name) like lower(concat('%', :q, '%'))
        order by t.name
        """)
    List<MedicineTemplate> search(@Param("doctorId") UUID doctorId, @Param("q") String q, Pageable pageable);

    Optional<MedicineTemplate> findByIdAndDoctorIdAndDeletedAtIsNull(UUID id, UUID doctorId);
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
                              String stockDisplay,
                              BigDecimal doseMorning, BigDecimal doseNoon,
                              BigDecimal doseAfternoon, BigDecimal doseEvening,
                              String usageNote, Integer numDays) {}

    /** Gợi ý khi kê đơn: thuốc mẫu TRƯỚC (tự điền liều), rồi tới thuốc kho (§5.4). */
    public record Suggestion(String type, UUID templateId, UUID medicineId, String name,
                             String baseUnit, String baseUnitLabel, String stockDisplay,
                             boolean injection,
                             BigDecimal doseMorning, BigDecimal doseNoon,
                             BigDecimal doseAfternoon, BigDecimal doseEvening,
                             String usageNote, Integer numDays) {}

    @Transactional(readOnly = true)
    public List<TemplateDto> list(UUID doctorId, String q) {
        return repository.search(doctorId, q == null ? "" : q.trim(), PageRequest.of(0, 100))
            .stream().map(t -> toDto(doctorId, t)).toList();
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

        for (var t : repository.search(doctorId, query, PageRequest.of(0, 5))) {
            Medicine m = t.getMedicineId() == null ? null
                : medicineService.findOwnedOrNull(doctorId, t.getMedicineId());
            out.add(new Suggestion("TEMPLATE", t.getId(), t.getMedicineId(), t.getName(),
                m != null ? m.getBaseUnit() : null,
                m != null ? MedicineService.UNIT_LABEL.getOrDefault(m.getBaseUnit(), m.getBaseUnit()) : null,
                m != null ? MedicineService.stockDisplay(m) : null,
                m != null && m.isInjection(),
                t.getDefaultDoseMorning(), t.getDefaultDoseNoon(),
                t.getDefaultDoseAfternoon(), t.getDefaultDoseEvening(),
                t.getDefaultUsageNote(), t.getDefaultNumDays()));
        }
        for (var m : medicineService.searchEntities(doctorId, query, 8)) {
            var already = out.stream().anyMatch(s -> m.getId().equals(s.medicineId()));
            if (already) continue;
            out.add(new Suggestion("MEDICINE", null, m.getId(), m.getName(),
                m.getBaseUnit(),
                MedicineService.UNIT_LABEL.getOrDefault(m.getBaseUnit(), m.getBaseUnit()),
                MedicineService.stockDisplay(m), m.isInjection(),
                null, null, null, null, null, null));
        }
        return out;
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
        Medicine m = t.getMedicineId() == null ? null
            : medicineService.findOwnedOrNull(doctorId, t.getMedicineId());
        return new TemplateDto(t.getId(), t.getName(), t.getMedicineId(),
            m != null ? m.getName() : null,
            m != null ? MedicineService.stockDisplay(m) : null,
            t.getDefaultDoseMorning(), t.getDefaultDoseNoon(),
            t.getDefaultDoseAfternoon(), t.getDefaultDoseEvening(),
            t.getDefaultUsageNote(), t.getDefaultNumDays());
    }
}
