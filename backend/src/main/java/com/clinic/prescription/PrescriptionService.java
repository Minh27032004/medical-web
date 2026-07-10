package com.clinic.prescription;

import com.clinic.appointment.AppointmentService;
import com.clinic.common.ApiException;
import com.clinic.medicine.MedicineRepository;
import com.clinic.patient.Patient;
import com.clinic.patient.PatientRepository;
import com.clinic.prescription.PrescriptionDtos.CreateRequest;
import com.clinic.prescription.PrescriptionDtos.ImageDto;
import com.clinic.prescription.PrescriptionDtos.ItemDto;
import com.clinic.prescription.PrescriptionDtos.PrescriptionDto;
import com.clinic.storage.SupabaseStorageService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PrescriptionService {

    private static final int SIGNED_URL_TTL_SECONDS = 3600;

    private final PrescriptionRepository prescriptionRepository;
    private final PatientRepository patientRepository;
    private final MedicineRepository medicineRepository;
    private final SupabaseStorageService storage;

    @Transactional
    public PrescriptionDto create(CreateRequest req) {
        var patient = patientRepository.findByIdAndDeletedAtIsNull(req.patientId())
            .orElseThrow(() -> ApiException.notFound("Không tìm thấy hồ sơ bệnh nhân"));

        var prescription = new Prescription();
        prescription.setPatientId(patient.getId());
        prescription.setAppointmentId(req.appointmentId());
        prescription.setSymptoms(req.symptoms());
        prescription.setDiagnosis(req.diagnosis());
        prescription.setExamFee(req.examFee());

        for (var line : req.items()) {
            var item = new PrescriptionItem();
            item.setQuantity(line.quantity());
            item.setDosage(line.dosage());
            if (line.medicineId() != null) {
                // Thuốc trong kho: snapshot tên + giá từ kho (D11)
                var medicine = medicineRepository.findByIdAndDeletedAtIsNull(line.medicineId())
                    .orElseThrow(() -> ApiException.badRequest(
                        "Thuốc \"" + line.medicineName() + "\" không còn trong kho"));
                item.setMedicineId(medicine.getId());
                item.setMedicineName(medicine.getName());
                item.setCostPrice(medicine.getCostPrice());
                item.setSalePrice(medicine.getSalePrice());
            } else {
                // Thuốc ngoài kho: bác sĩ tự nhập tên + giá
                item.setMedicineName(line.medicineName().trim());
                item.setCostPrice(line.costPrice() != null ? line.costPrice() : BigDecimal.ZERO);
                item.setSalePrice(line.salePrice() != null ? line.salePrice() : BigDecimal.ZERO);
            }
            prescription.getItems().add(item);
        }

        if (req.images() != null) {
            for (var img : req.images()) {
                var image = new PrescriptionImage();
                image.setImagePath(img.imagePath());
                image.setKind(img.kind() != null ? img.kind() : PrescriptionImage.KIND_OTHER);
                prescription.getImages().add(image);
            }
        }

        return toDto(prescriptionRepository.save(prescription), patient, true);
    }

    /** Lịch sử khám theo ngày (giờ VN) — kèm giá gốc cho Doctor. */
    @Transactional(readOnly = true)
    public List<PrescriptionDto> listByDate(LocalDate date) {
        var from = date.atStartOfDay(AppointmentService.CLINIC_ZONE).toInstant();
        var to = date.plusDays(1).atStartOfDay(AppointmentService.CLINIC_ZONE).toInstant();
        var list = prescriptionRepository
            .findByCreatedAtBetweenAndDeletedAtIsNullOrderByCreatedAtDesc(from, to);
        return withPatients(list, true);
    }

    @Transactional(readOnly = true)
    public List<PrescriptionDto> listByPatient(UUID patientId) {
        return withPatients(
            prescriptionRepository.findByPatientIdAndDeletedAtIsNullOrderByCreatedAtDesc(patientId),
            true);
    }

    /** Đơn thuốc của chính Patient đang đăng nhập — ẩn giá gốc. */
    @Transactional(readOnly = true)
    public List<PrescriptionDto> listForProfile(UUID profileId) {
        var myPatients = patientRepository.findByProfileIdAndDeletedAtIsNull(profileId);
        if (myPatients.isEmpty()) return List.of();
        var list = prescriptionRepository.findByPatientIdInAndDeletedAtIsNullOrderByCreatedAtDesc(
            myPatients.stream().map(Patient::getId).toList());
        return withPatients(list, false);
    }

    private List<PrescriptionDto> withPatients(List<Prescription> list, boolean forDoctor) {
        if (list.isEmpty()) return List.of();
        Map<UUID, Patient> patients = patientRepository
            .findAllById(list.stream().map(Prescription::getPatientId).distinct().toList())
            .stream().collect(Collectors.toMap(Patient::getId, Function.identity()));
        return list.stream()
            .map(p -> toDto(p, patients.get(p.getPatientId()), forDoctor))
            .toList();
    }

    private PrescriptionDto toDto(Prescription p, Patient patient, boolean forDoctor) {
        var medicineTotal = p.getItems().stream()
            .map(i -> i.getSalePrice().multiply(BigDecimal.valueOf(i.getQuantity())))
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        var costTotal = p.getItems().stream()
            .map(i -> i.getCostPrice().multiply(BigDecimal.valueOf(i.getQuantity())))
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        return new PrescriptionDto(
            p.getId(),
            p.getPatientId(),
            patient != null ? patient.getFullName() : null,
            p.getSymptoms(),
            p.getDiagnosis(),
            p.getExamFee(),
            medicineTotal,
            forDoctor ? costTotal : null,
            p.getCreatedAt(),
            p.getItems().stream()
                .map(i -> new ItemDto(i.getMedicineName(), i.getQuantity(), i.getDosage(),
                    forDoctor ? i.getCostPrice() : null, i.getSalePrice()))
                .toList(),
            p.getImages().stream()
                .map(img -> new ImageDto(img.getId(), img.getKind(),
                    storage.signedUrl(img.getImagePath(), SIGNED_URL_TTL_SECONDS)))
                .toList()
        );
    }
}
