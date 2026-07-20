package com.clinic.visit;

import com.clinic.auth.UserRepository;
import com.clinic.common.ApiException;
import com.clinic.medicine.MedicineService;
import com.clinic.patient.Patient;
import com.clinic.patient.PatientService;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** MỌI finder đều kèm deletedAtIsNull — lần khám đã xóa mềm (V12) không được lọt vào bất kỳ đâu. */
interface VisitRepository extends JpaRepository<Visit, UUID> {

    List<Visit> findByDoctorIdAndDeletedAtIsNullAndVisitDateBetweenOrderByVisitDateDesc(
        UUID doctorId, Instant from, Instant to);

    List<Visit> findByDoctorIdAndPatientIdAndDeletedAtIsNullOrderByVisitDateDesc(
        UUID doctorId, UUID patientId);

    List<Visit> findByDoctorIdAndPatientIdAndDeletedAtIsNullAndVisitDateBetweenOrderByVisitDateDesc(
        UUID doctorId, UUID patientId, Instant from, Instant to);

    Optional<Visit> findByIdAndDoctorIdAndDeletedAtIsNull(UUID id, UUID doctorId);

    Optional<Visit> findFirstByDoctorIdAndPatientIdAndDeletedAtIsNullOrderByVisitDateDesc(
        UUID doctorId, UUID patientId);
}

interface PrescriptionRepository extends JpaRepository<Prescription, UUID> {

    Optional<Prescription> findByVisitId(UUID visitId);

    Optional<Prescription> findByIdAndDoctorId(UUID id, UUID doctorId);

    /** Các visit (trong tập cho trước) có ít nhất 1 dòng thuốc tiêm. */
    @Query("""
        select distinct p.visitId from Prescription p join p.items i
        where p.doctorId = :doctorId and i.injection = true and p.visitId in :visitIds
        """)
    Set<UUID> visitIdsWithInjection(@Param("doctorId") UUID doctorId,
                                    @Param("visitIds") List<UUID> visitIds);
}

@Service
@RequiredArgsConstructor
public class VisitService {

    public static final ZoneId CLINIC_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final VisitRepository visitRepository;
    private final PrescriptionRepository prescriptionRepository;
    private final PatientService patientService;
    private final MedicineService medicineService;
    private final UserRepository userRepository;

    // ===== DTO =====

    public record ItemRequest(UUID medicineId, String medicineName,
                              BigDecimal doseMorning, BigDecimal doseNoon,
                              BigDecimal doseAfternoon, BigDecimal doseEvening,
                              String specialDoseText, String usageNote, Integer numDays,
                              BigDecimal totalQuantityBase, boolean injection, boolean infusion) {}

    public record CreateRequest(UUID patientId, String diagnosisCode, String diagnosisName,
                                List<Diagnosis> secondaryDiagnoses,
                                String note, List<ItemRequest> items) {}

    public record ItemDto(UUID medicineId, String medicineName, String baseUnit, String baseUnitLabel,
                          BigDecimal doseMorning, BigDecimal doseNoon,
                          BigDecimal doseAfternoon, BigDecimal doseEvening,
                          String specialDoseText, String usageNote, Integer numDays,
                          BigDecimal totalQuantityBase, boolean injection, boolean infusion) {}

    public record VisitRow(UUID id, Instant visitDate, UUID patientId, String patientName,
                           String diagnosisCode, String diagnosisName, boolean hasInjection) {}

    public record PatientInfo(UUID id, String fullName, String phone, String gender, String address,
                              boolean hasDrugAllergy, String drugAllergyNote,
                              boolean hasChronicCondition, String chronicConditionNote) {}

    public record DoctorInfo(String fullName, String clinicName, String phone) {}

    public record VisitDetail(UUID id, Instant visitDate, String diagnosisCode, String diagnosisName,
                              List<Diagnosis> secondaryDiagnoses,
                              String note, PatientInfo patient, DoctorInfo doctor,
                              UUID prescriptionId, Instant printedAt, List<ItemDto> items) {}

    // ===== Tạo lần khám + đơn thuốc + trừ kho (MỘT transaction — §7) =====

    @Transactional
    public VisitDetail create(UUID doctorId, CreateRequest req) {
        var patient = patientService.findOwned(doctorId, req.patientId());
        if (isBlank(req.diagnosisCode()) || isBlank(req.diagnosisName())) {
            throw ApiException.badRequest("Chẩn đoán ICD-10 là bắt buộc");
        }

        var visit = new Visit();
        visit.setDoctorId(doctorId);
        visit.setPatientId(patient.getId());
        visit.setDiagnosisCode(req.diagnosisCode().trim().toUpperCase());
        visit.setDiagnosisName(req.diagnosisName().trim());
        // Chẩn đoán phụ: lọc rỗng, chuẩn hóa mã hoa, bỏ trùng mã (giữ thứ tự nhập).
        if (req.secondaryDiagnoses() != null) {
            var seen = new java.util.LinkedHashSet<String>();
            var sec = new java.util.ArrayList<Diagnosis>();
            for (var d : req.secondaryDiagnoses()) {
                if (d == null || isBlank(d.code()) || isBlank(d.name())) continue;
                var code = d.code().trim().toUpperCase();
                if (code.equalsIgnoreCase(visit.getDiagnosisCode()) || !seen.add(code)) continue;
                sec.add(new Diagnosis(code, d.name().trim()));
            }
            visit.setSecondaryDiagnoses(sec);
        }
        visit.setNote(req.note());
        visit = visitRepository.save(visit);

        var prescription = new Prescription();
        prescription.setDoctorId(doctorId);
        prescription.setVisitId(visit.getId());

        if (req.items() != null) {
            for (var in : req.items()) {
                if (in.medicineId() == null && isBlank(in.medicineName())) continue;

                var item = new PrescriptionItem();
                item.setDoseMorning(orZero(in.doseMorning()));
                item.setDoseNoon(orZero(in.doseNoon()));
                item.setDoseAfternoon(orZero(in.doseAfternoon()));
                item.setDoseEvening(orZero(in.doseEvening()));
                item.setSpecialDoseText(in.specialDoseText());
                item.setUsageNote(in.usageNote());
                item.setNumDays(in.numDays());

                // total = liều/ngày × số ngày (§6.3); FE có thể gửi đè cho ca đặc biệt/tiêm
                var daily = item.getDoseMorning().add(item.getDoseNoon())
                    .add(item.getDoseAfternoon()).add(item.getDoseEvening());
                var computed = in.numDays() != null && in.numDays() > 0
                    ? daily.multiply(BigDecimal.valueOf(in.numDays()))
                    : BigDecimal.ZERO;
                var total = in.totalQuantityBase() != null && in.totalQuantityBase().signum() > 0
                    ? in.totalQuantityBase() : computed;
                item.setTotalQuantityBase(total);

                if (in.medicineId() != null) {
                    var medicine = medicineService.findOwned(doctorId, in.medicineId());
                    item.setMedicineId(medicine.getId());
                    item.setMedicineName(medicine.getName()); // snapshot
                    item.setBaseUnit(medicine.getBaseUnit()); // snapshot
                    item.setInjection(medicine.isInjection());
                    item.setInfusion(medicine.isInfusion());
                    if (total.signum() > 0) {
                        medicineService.deductStock(medicine, total); // cùng transaction
                    }
                } else {
                    item.setMedicineName(in.medicineName().trim());
                    item.setBaseUnit(in.injection() ? "ong" : in.infusion() ? "chai" : "vien");
                    item.setInjection(in.injection());
                    item.setInfusion(in.infusion());
                }
                prescription.getItems().add(item);
            }
        }

        prescriptionRepository.save(prescription);
        return detail(doctorId, visit.getId());
    }

    // ===== Đọc =====

    /** Lịch sử khám — mặc định 30 ngày gần nhất (§5.6). from/to theo ngày giờ VN. */
    @Transactional(readOnly = true)
    public List<VisitRow> history(UUID doctorId, LocalDate from, LocalDate to) {
        var toDate = to != null ? to : LocalDate.now(CLINIC_ZONE);
        var fromDate = from != null ? from : toDate.minusDays(30);
        var fromI = fromDate.atStartOfDay(CLINIC_ZONE).toInstant();
        var toI = toDate.plusDays(1).atStartOfDay(CLINIC_ZONE).toInstant();
        return toRows(doctorId,
            visitRepository.findByDoctorIdAndDeletedAtIsNullAndVisitDateBetweenOrderByVisitDateDesc(
                doctorId, fromI, toI));
    }

    @Transactional(readOnly = true)
    public List<VisitRow> visitsOfPatient(UUID doctorId, UUID patientId) {
        patientService.findOwned(doctorId, patientId);
        return toRows(doctorId,
            visitRepository.findByDoctorIdAndPatientIdAndDeletedAtIsNullOrderByVisitDateDesc(
                doctorId, patientId));
    }

    /** Lần khám gần nhất của bệnh nhân (kèm tên + có tiêm) — cho trợ lý chat LAST_VISIT. */
    @Transactional(readOnly = true)
    public Optional<VisitRow> lastVisit(UUID doctorId, UUID patientId) {
        return visitRepository.findFirstByDoctorIdAndPatientIdAndDeletedAtIsNullOrderByVisitDateDesc(doctorId, patientId)
            .map(v -> toRows(doctorId, List.of(v)).get(0));
    }

    /** Đếm số lần khám của bệnh nhân trong khoảng (null = 30 ngày gần nhất) — chat VISIT_COUNT. */
    @Transactional(readOnly = true)
    public int countVisits(UUID doctorId, UUID patientId, LocalDate from, LocalDate to) {
        return rangeVisits(doctorId, patientId, from, to).size();
    }

    /** Đếm số lần khám CÓ TIÊM của bệnh nhân trong khoảng — chat INJECTION_COUNT. */
    @Transactional(readOnly = true)
    public int countInjectionVisits(UUID doctorId, UUID patientId, LocalDate from, LocalDate to) {
        var visits = rangeVisits(doctorId, patientId, from, to);
        if (visits.isEmpty()) return 0;
        var ids = visits.stream().map(Visit::getId).toList();
        return prescriptionRepository.visitIdsWithInjection(doctorId, ids).size();
    }

    private List<Visit> rangeVisits(UUID doctorId, UUID patientId, LocalDate from, LocalDate to) {
        var toDate = to != null ? to : LocalDate.now(CLINIC_ZONE);
        var fromDate = from != null ? from : toDate.minusDays(30);
        var fromI = fromDate.atStartOfDay(CLINIC_ZONE).toInstant();
        var toI = toDate.plusDays(1).atStartOfDay(CLINIC_ZONE).toInstant();
        return visitRepository.findByDoctorIdAndPatientIdAndDeletedAtIsNullAndVisitDateBetweenOrderByVisitDateDesc(
            doctorId, patientId, fromI, toI);
    }

    @Transactional(readOnly = true)
    public VisitDetail detail(UUID doctorId, UUID visitId) {
        var visit = visitRepository.findByIdAndDoctorIdAndDeletedAtIsNull(visitId, doctorId)
            .orElseThrow(() -> ApiException.notFound("Không tìm thấy lần khám"));
        // Bệnh nhân có thể đã bị xóa mềm — lần khám cũ vẫn phải xem/in lại được.
        var patient = patientService.findOwnedEvenDeleted(doctorId, visit.getPatientId());
        var doctor = userRepository.findById(doctorId).orElseThrow();
        var prescription = prescriptionRepository.findByVisitId(visit.getId()).orElse(null);

        return new VisitDetail(visit.getId(), visit.getVisitDate(),
            visit.getDiagnosisCode(), visit.getDiagnosisName(),
            visit.getSecondaryDiagnoses(), visit.getNote(),
            toPatientInfo(patient),
            new DoctorInfo(doctor.getFullName(), doctor.getClinicName(), doctor.getPhone()),
            prescription != null ? prescription.getId() : null,
            prescription != null ? prescription.getPrintedAt() : null,
            prescription != null
                ? prescription.getItems().stream().map(VisitService::toItemDto).toList()
                : List.of());
    }

    /** Đơn gần nhất của bệnh nhân — cho nút "Tạo lại đơn gần nhất" (§5.4). */
    @Transactional(readOnly = true)
    public List<ItemDto> lastPrescriptionItems(UUID doctorId, UUID patientId) {
        patientService.findOwned(doctorId, patientId);
        return visitRepository.findFirstByDoctorIdAndPatientIdAndDeletedAtIsNullOrderByVisitDateDesc(doctorId, patientId)
            .flatMap(v -> prescriptionRepository.findByVisitId(v.getId()))
            .map(p -> p.getItems().stream().map(VisitService::toItemDto).toList())
            .orElse(List.of());
    }

    /**
     * XÓA MỀM lần khám (V12). Đơn thuốc giữ nguyên trong DB, chỉ ẩn theo visit cha.
     * restoreStock = bác sĩ chọn trên popup: true khi xóa vì nhập nhầm (thuốc chưa phát ra),
     * false khi thuốc đã đưa cho bệnh nhân rồi.
     */
    @Transactional
    public void softDelete(UUID doctorId, UUID visitId, boolean restoreStock) {
        var visit = visitRepository.findByIdAndDoctorIdAndDeletedAtIsNull(visitId, doctorId)
            .orElseThrow(() -> ApiException.notFound("Không tìm thấy lần khám"));

        if (restoreStock) {
            prescriptionRepository.findByVisitId(visitId).ifPresent(p -> {
                for (var i : p.getItems()) {
                    if (i.getMedicineId() == null || i.getTotalQuantityBase().signum() <= 0) continue;
                    var m = medicineService.findOwnedOrNull(doctorId, i.getMedicineId());
                    if (m == null) continue; // thuốc đã xóa khỏi kho → không còn chỗ để hoàn
                    // total_quantity_base là SNAPSHOT theo base_unit lúc kê. Nếu sau đó bác sĩ
                    // đã đổi cấu trúc đơn vị của thuốc thì con số không còn cùng hệ quy chiếu
                    // → cộng vào sẽ sai tồn. Bỏ qua, để bác sĩ tự chỉnh bằng "Nhập / chỉnh".
                    if (!i.getBaseUnit().equals(m.getBaseUnit())) continue;
                    medicineService.restoreStock(m, i.getTotalQuantityBase());
                }
            });
        }

        visit.setDeletedAt(Instant.now());
        visitRepository.save(visit);
    }

    @Transactional
    public void markPrinted(UUID doctorId, UUID prescriptionId) {
        var p = prescriptionRepository.findByIdAndDoctorId(prescriptionId, doctorId)
            .orElseThrow(() -> ApiException.notFound("Không tìm thấy đơn thuốc"));
        p.setPrintedAt(Instant.now());
        prescriptionRepository.save(p);
    }

    // ===== Helpers =====

    private List<VisitRow> toRows(UUID doctorId, List<Visit> visits) {
        if (visits.isEmpty()) return List.of();
        var ids = visits.stream().map(Visit::getId).toList();
        var withInjection = prescriptionRepository.visitIdsWithInjection(doctorId, ids);
        var patients = patientService.mapByIds(doctorId,
            visits.stream().map(Visit::getPatientId).collect(Collectors.toSet()));
        return visits.stream().map(v -> new VisitRow(
            v.getId(), v.getVisitDate(), v.getPatientId(),
            patients.containsKey(v.getPatientId()) ? patients.get(v.getPatientId()).getFullName() : "?",
            v.getDiagnosisCode(), v.getDiagnosisName(),
            withInjection.contains(v.getId()))).toList();
    }

    private static PatientInfo toPatientInfo(Patient p) {
        return new PatientInfo(p.getId(), p.getFullName(), p.getPhone(), p.getGender(),
            p.getAddress(), p.isHasDrugAllergy(), p.getDrugAllergyNote(),
            p.isHasChronicCondition(), p.getChronicConditionNote());
    }

    private static ItemDto toItemDto(PrescriptionItem i) {
        return new ItemDto(i.getMedicineId(), i.getMedicineName(), i.getBaseUnit(),
            MedicineService.UNIT_LABEL.getOrDefault(i.getBaseUnit(), i.getBaseUnit()),
            i.getDoseMorning(), i.getDoseNoon(), i.getDoseAfternoon(), i.getDoseEvening(),
            i.getSpecialDoseText(), i.getUsageNote(), i.getNumDays(),
            i.getTotalQuantityBase(), i.isInjection(), i.isInfusion());
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private static BigDecimal orZero(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }
}
