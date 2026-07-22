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
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** MỌI finder đều kèm deletedAtIsNull — lần khám đã xóa mềm (V12) không được lọt vào bất kỳ đâu. */
interface VisitRepository extends JpaRepository<Visit, UUID> {

    List<Visit> findByDoctorIdAndDeletedAtIsNullAndVisitDateBetweenOrderByVisitDateDesc(
        UUID doctorId, Instant from, Instant to);

    /** Lịch sử khám của MỘT bệnh nhân, mới → cũ, có phân trang (hồ sơ bệnh nhân). */
    Page<Visit> findByDoctorIdAndPatientIdAndDeletedAtIsNullOrderByVisitDateDesc(
        UUID doctorId, UUID patientId, Pageable pageable);

    List<Visit> findByDoctorIdAndPatientIdAndDeletedAtIsNullAndVisitDateBetweenOrderByVisitDateDesc(
        UUID doctorId, UUID patientId, Instant from, Instant to);

    /**
     * ĐẾM số lần khám trong khoảng. Trợ lý chat chỉ cần con số, nên để DB đếm thay vì kéo
     * hàng chục entity Visit qua đường truyền sang Mumbai rồi gọi .size() ở Java.
     */
    int countByDoctorIdAndPatientIdAndDeletedAtIsNullAndVisitDateBetween(
        UUID doctorId, UUID patientId, Instant from, Instant to);

    Optional<Visit> findByIdAndDoctorIdAndDeletedAtIsNull(UUID id, UUID doctorId);

    Optional<Visit> findFirstByDoctorIdAndPatientIdAndDeletedAtIsNullOrderByVisitDateDesc(
        UUID doctorId, UUID patientId);

    /** Tra theo khóa chống trùng (V15) — KHÔNG lọc deletedAt: đơn đã xóa vẫn tính là đã tạo. */
    Optional<Visit> findByDoctorIdAndClientRequestId(UUID doctorId, UUID clientRequestId);
}

interface PrescriptionRepository extends JpaRepository<Prescription, UUID> {

    /** LUÔN kèm doctorId — quy tắc cô lập số 1, không dựa vào việc caller đã verify visit. */
    Optional<Prescription> findByVisitIdAndDoctorId(UUID visitId, UUID doctorId);

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
                                String note, List<ItemRequest> items,
                                /** V15 — cùng id = cùng một lần bấm Lưu, không tạo bản ghi mới. */
                                UUID clientRequestId) {}

    public record ItemDto(UUID medicineId, String medicineName, String baseUnit, String baseUnitLabel,
                          BigDecimal doseMorning, BigDecimal doseNoon,
                          BigDecimal doseAfternoon, BigDecimal doseEvening,
                          String specialDoseText, String usageNote, Integer numDays,
                          BigDecimal totalQuantityBase, boolean injection, boolean infusion) {}

    public record VisitRow(UUID id, Instant visitDate, UUID patientId, String patientName,
                           String diagnosisCode, String diagnosisName, boolean hasInjection) {}

    public record PatientInfo(UUID id, String fullName, String phone, String gender,
                              Integer age, String address,
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
        // Gửi lại đúng id đã dùng = lần bấm Lưu cũ chỉ bị mất phản hồi. Trả về lần khám đã
        // tạo, TUYỆT ĐỐI không tạo mới và không trừ kho thêm lần nữa (V15).
        if (req.clientRequestId() != null) {
            var existing = visitRepository
                .findByDoctorIdAndClientRequestId(doctorId, req.clientRequestId());
            if (existing.isPresent()) {
                return detail(doctorId, existing.get().getId());
            }
        }
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
        visit.setClientRequestId(req.clientRequestId());
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
                    // Khóa ghi ngay từ lúc nạp: trừ kho là read-modify-write, không khóa thì
                    // hai đơn lưu đồng thời cùng một thuốc sẽ mất một lượt trừ.
                    var medicine = medicineService.findOwnedForUpdate(doctorId, in.medicineId());
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

    /**
     * Lịch sử khám của một bệnh nhân — CÓ PHÂN TRANG.
     *
     * Trước đây trả trọn danh sách. Bệnh nhân mạn tính tái khám hàng tháng thì sau vài năm
     * mỗi lần mở hồ sơ là kéo về cả trăm dòng, trong khi bác sĩ hầu như chỉ nhìn vài lần
     * gần nhất. Phân trang ở tầng DB nên không phải nạp rồi mới cắt.
     */
    @Transactional(readOnly = true)
    public Page<VisitRow> visitsOfPatient(UUID doctorId, UUID patientId, Pageable pageable) {
        patientService.findOwned(doctorId, patientId);
        var page = visitRepository.findByDoctorIdAndPatientIdAndDeletedAtIsNullOrderByVisitDateDesc(
            doctorId, patientId, pageable);
        // toRows gom tên bệnh nhân + cờ có-tiêm theo LÔ, nên chỉ chạy trên trang hiện tại.
        return new PageImpl<>(toRows(doctorId, page.getContent()), pageable, page.getTotalElements());
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
        var span = rangeInstants(from, to);
        return visitRepository.countByDoctorIdAndPatientIdAndDeletedAtIsNullAndVisitDateBetween(
            doctorId, patientId, span[0], span[1]);
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
        var span = rangeInstants(from, to);
        return visitRepository.findByDoctorIdAndPatientIdAndDeletedAtIsNullAndVisitDateBetweenOrderByVisitDateDesc(
            doctorId, patientId, span[0], span[1]);
    }

    /** [from 00:00, to+1 00:00) theo giờ phòng khám; null = 30 ngày gần nhất. */
    private static Instant[] rangeInstants(LocalDate from, LocalDate to) {
        var toDate = to != null ? to : LocalDate.now(CLINIC_ZONE);
        var fromDate = from != null ? from : toDate.minusDays(30);
        return new Instant[] {
            fromDate.atStartOfDay(CLINIC_ZONE).toInstant(),
            toDate.plusDays(1).atStartOfDay(CLINIC_ZONE).toInstant()
        };
    }

    @Transactional(readOnly = true)
    public VisitDetail detail(UUID doctorId, UUID visitId) {
        var visit = visitRepository.findByIdAndDoctorIdAndDeletedAtIsNull(visitId, doctorId)
            .orElseThrow(() -> ApiException.notFound("Không tìm thấy lần khám"));
        // Bệnh nhân có thể đã bị xóa mềm — lần khám cũ vẫn phải xem/in lại được.
        var patient = patientService.findOwnedEvenDeleted(doctorId, visit.getPatientId());
        var doctor = userRepository.findById(doctorId).orElseThrow();
        var prescription = prescriptionRepository.findByVisitIdAndDoctorId(visit.getId(), doctorId).orElse(null);

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
            .flatMap(v -> prescriptionRepository.findByVisitIdAndDoctorId(v.getId(), doctorId))
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
            prescriptionRepository.findByVisitIdAndDoctorId(visitId, doctorId).ifPresent(p -> {
                for (var i : p.getItems()) {
                    if (i.getMedicineId() == null || i.getTotalQuantityBase().signum() <= 0) continue;
                    var m = medicineService.findOwnedForUpdateOrNull(doctorId, i.getMedicineId());
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

    /**
     * SỬA lần khám = THAY THẾ (D12 — không sửa đè, giữ vết).
     *
     * Hoàn kho theo đơn cũ → xóa mềm bản cũ → tạo lần khám mới → trừ kho theo đơn mới,
     * tất cả trong MỘT transaction. Hỏng ở bước nào thì rollback sạch, không có cảnh
     * "đã hoàn kho nhưng chưa trừ lại" — với sổ sách thuốc đó là hỏng nặng nhất.
     *
     * Vì sao thay thế chứ không UPDATE tại chỗ: bản sai vẫn nằm trong DB làm vết (chỉ ẩn
     * khỏi giao diện), và toàn bộ đường hoàn kho/trừ kho tái dùng code đã chạy ổn thay vì
     * viết một nhánh cập nhật song song — nhánh nào ít người đi thì nhánh đó nhiều lỗi.
     *
     * CHỈ cho sửa trong NGÀY KHÁM: hoàn kho hôm nay cho thuốc đã phát tuần trước thì số
     * tồn đúng nhưng dòng thời gian sai, đối chiếu sổ sách sau này không lần ra được.
     */
    @Transactional
    public VisitDetail replace(UUID doctorId, UUID oldVisitId, CreateRequest req) {
        // Bấm Lưu hai lần (hoặc mất phản hồi rồi thử lại): lần sau gửi đúng clientRequestId
        // cũ → trả về bản đã tạo. Phải kiểm TRƯỚC khi tìm bản cũ, vì lúc đó bản cũ đã bị
        // xóa mềm rồi, đi tiếp sẽ báo "không tìm thấy lần khám" — đúng kỹ thuật nhưng vô
        // nghĩa với bác sĩ đang nhìn màn hình.
        if (req.clientRequestId() != null) {
            var existing = visitRepository
                .findByDoctorIdAndClientRequestId(doctorId, req.clientRequestId());
            if (existing.isPresent()) {
                return detail(doctorId, existing.get().getId());
            }
        }

        var old = visitRepository.findByIdAndDoctorIdAndDeletedAtIsNull(oldVisitId, doctorId)
            .orElseThrow(() -> ApiException.notFound("Không tìm thấy lần khám cần sửa"));

        var visitDay = old.getVisitDate().atZone(CLINIC_ZONE).toLocalDate();
        if (!visitDay.equals(LocalDate.now(CLINIC_ZONE))) {
            throw ApiException.badRequest(
                "Chỉ sửa được đơn trong ngày khám. Đơn cũ hơn thì xóa rồi kê lại nếu cần.");
        }

        // Bản sửa PHẢI cùng bệnh nhân. patientId đến từ URL của form, không phải từ bản
        // ghi cũ — lệch một ký tự trên thanh địa chỉ là xóa lần khám của người này rồi
        // dựng lại nó cho người khác, và không có gì trên màn hình báo cho bác sĩ biết.
        if (!old.getPatientId().equals(req.patientId())) {
            throw ApiException.badRequest("Bản sửa phải cùng bệnh nhân với lần khám gốc");
        }

        /*
         * Chặn TRƯỚC khi động vào kho: softDelete cố tình BỎ QUA việc hoàn những thuốc đã
         * đổi cấu trúc đơn vị sau lúc kê (số cũ khác hệ quy chiếu, cộng vào là sai tồn).
         * Với xóa thì bỏ qua là đúng. Nhưng với sửa thì create ngay sau đó VẪN trừ kho
         * theo đơn mới → thuốc đó bị trừ hai lần mà không có lỗi nào báo ra. Thà từ chối
         * sửa còn hơn làm lệch sổ thuốc một cách âm thầm.
         */
        prescriptionRepository.findByVisitIdAndDoctorId(oldVisitId, doctorId).ifPresent(p -> {
            for (var i : p.getItems()) {
                if (i.getMedicineId() == null || i.getTotalQuantityBase().signum() <= 0) continue;
                var m = medicineService.findOwnedForUpdateOrNull(doctorId, i.getMedicineId());
                if (m == null) continue; // thuốc đã xóa khỏi kho — create sẽ báo lỗi rõ hơn
                if (!i.getBaseUnit().equals(m.getBaseUnit())) {
                    throw ApiException.badRequest("Thuốc \"" + i.getMedicineName()
                        + "\" đã đổi đơn vị sau khi kê nên không sửa được đơn này."
                        + " Hãy xóa lần khám (có tick hoàn kho) rồi kê lại.");
                }
            }
        });

        softDelete(doctorId, oldVisitId, true); // hoàn kho theo snapshot đơn cũ
        var created = create(doctorId, req);    // trừ kho theo đơn mới

        // Giữ nguyên GIỜ khám gốc: bác sĩ khám lúc 8h, sửa lúc 11h thì lịch sử vẫn phải
        // ghi 8h — đó là thời điểm khám thật, không phải thời điểm sửa.
        var fresh = visitRepository.findByIdAndDoctorIdAndDeletedAtIsNull(created.id(), doctorId)
            .orElseThrow(() -> ApiException.notFound("Không tìm thấy lần khám vừa tạo"));
        fresh.setVisitDate(old.getVisitDate());
        visitRepository.save(fresh);

        return detail(doctorId, created.id());
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
            p.getAge(), p.getAddress(), p.isHasDrugAllergy(), p.getDrugAllergyNote(),
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
