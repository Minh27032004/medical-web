package com.clinic.appointment;

import com.clinic.appointment.AppointmentDtos.AvailabilityRow;
import com.clinic.appointment.AppointmentDtos.DoctorAppointment;
import com.clinic.appointment.AppointmentDtos.DocumentDto;
import com.clinic.appointment.AppointmentDtos.PatientAppointment;
import com.clinic.appointment.AppointmentDtos.Slot;
import com.clinic.auth.ProfileRepository;
import com.clinic.common.ApiException;
import com.clinic.storage.SupabaseStorageService;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AppointmentService {

    /** Phòng khám hoạt động theo giờ Việt Nam. */
    public static final ZoneId CLINIC_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final int SIGNED_URL_TTL_SECONDS = 3600;

    private final AppointmentRepository appointmentRepository;
    private final AppointmentDocumentRepository documentRepository;
    private final DoctorAvailabilityRepository availabilityRepository;
    private final ProfileRepository profileRepository;
    private final SupabaseStorageService storage;
    private final com.clinic.notification.NotificationService notificationService;

    // ===== Slot trống (public) =====

    @Transactional(readOnly = true)
    public List<Slot> slotsForDate(LocalDate date) {
        int weekday = date.getDayOfWeek().getValue() % 7; // Java: MON=1..SUN=7 → DB: 0=CN
        var windows = availabilityRepository.findByWeekdayOrderByStartTime(weekday);
        if (windows.isEmpty()) return List.of();

        // Nhiều người được đặt cùng giờ (V3) → slot chỉ cần còn ở TƯƠNG LAI là gợi ý được
        var now = Instant.now();
        var slots = new ArrayList<Slot>();
        for (var w : windows) {
            var cursor = date.atTime(w.getStartTime()).atZone(CLINIC_ZONE).toInstant();
            var windowEnd = date.atTime(w.getEndTime()).atZone(CLINIC_ZONE).toInstant();
            var step = Duration.ofMinutes(w.getSlotMinutes());
            while (!cursor.plus(step).isAfter(windowEnd)) {
                var end = cursor.plus(step);
                slots.add(new Slot(cursor, end, cursor.isAfter(now)));
                cursor = end;
            }
        }
        return slots;
    }

    // ===== Patient =====

    /** Bệnh nhân TỰ NHẬP giờ khám — validate: đúng giờ làm việc, sau hiện tại, trong 7 ngày. */
    public static final int MAX_BOOKING_DAYS = 7;

    @Transactional
    public PatientAppointment book(UUID profileId, Instant slotStart, String note) {
        var now = Instant.now();
        if (!slotStart.isAfter(now)) {
            throw ApiException.badRequest("Giờ khám phải sau thời điểm hiện tại");
        }
        if (slotStart.isAfter(now.plus(Duration.ofDays(MAX_BOOKING_DAYS)))) {
            throw ApiException.badRequest("Chỉ nhận đặt lịch trước tối đa " + MAX_BOOKING_DAYS + " ngày");
        }

        // Giờ nhập phải nằm trọn trong một khung giờ làm việc của thứ đó
        var zoned = slotStart.atZone(CLINIC_ZONE);
        int weekday = zoned.getDayOfWeek().getValue() % 7;
        var time = zoned.toLocalTime();
        var window = availabilityRepository.findByWeekdayOrderByStartTime(weekday).stream()
            .filter(w -> !time.isBefore(w.getStartTime())
                && !time.plusMinutes(w.getSlotMinutes()).isAfter(w.getEndTime()))
            .findFirst()
            .orElseThrow(() -> ApiException.badRequest(
                "Giờ này ngoài giờ làm việc của phòng khám — xem khung giờ bên trên"));

        // Nhiều bệnh nhân được đặt CÙNG khung giờ — phòng khám khám theo thứ tự đến (V3)
        var slotEnd = slotStart.plus(Duration.ofMinutes(window.getSlotMinutes()));

        var appt = new Appointment();
        appt.setProfileId(profileId);
        appt.setSlotStart(slotStart);
        appt.setSlotEnd(slotEnd);
        appt.setNote(note);
        var saved = appointmentRepository.save(appt);

        var patientName = profileRepository.findById(profileId)
            .map(p -> p.getFullName() != null ? p.getFullName() : "Bệnh nhân")
            .orElse("Bệnh nhân");
        var timeLabel = java.time.format.DateTimeFormatter.ofPattern("HH:mm 'ngày' dd/MM")
            .format(slotStart.atZone(CLINIC_ZONE));
        notificationService.notify(
            com.clinic.notification.Notification.TYPE_NEW_APPOINTMENT,
            "📅 Lịch hẹn mới: " + patientName,
            timeLabel + (note != null && !note.isBlank() ? " — " + note : ""),
            "/doctor/appointments");

        return toPatient(saved);
    }

    @Transactional(readOnly = true)
    public List<PatientAppointment> listMine(UUID profileId) {
        return appointmentRepository.findByProfileIdOrderBySlotStartDesc(profileId)
            .stream().map(this::toPatient).toList();
    }

    @Transactional
    public PatientAppointment cancelMine(UUID profileId, UUID appointmentId) {
        var appt = findOwned(profileId, appointmentId);
        if (!appt.getStatus().isActive()) {
            throw ApiException.conflict("Lịch hẹn đã kết thúc, không hủy được");
        }
        appt.setStatus(AppointmentStatus.CANCELLED);
        return toPatient(appointmentRepository.save(appt));
    }

    /** Upload ảnh giấy khám sức khỏe — bucket PRIVATE medical-docs. */
    @Transactional
    public DocumentDto addDocument(UUID profileId, UUID appointmentId,
                                   byte[] content, String contentType, String ext) {
        var appt = findOwned(profileId, appointmentId);
        if (!appt.getStatus().isActive()) {
            throw ApiException.conflict("Lịch hẹn đã kết thúc, không gửi thêm được");
        }
        var path = "medical-docs/appointments/" + appointmentId + "/" + UUID.randomUUID() + "." + ext;
        storage.upload(path, content, contentType);

        var doc = new AppointmentDocument();
        doc.setAppointmentId(appointmentId);
        doc.setImagePath(path);
        var saved = documentRepository.save(doc);
        return new DocumentDto(saved.getId(), storage.signedUrl(path, SIGNED_URL_TTL_SECONDS));
    }

    // ===== Doctor =====

    @Transactional(readOnly = true)
    public List<DoctorAppointment> listForDoctor(LocalDate date) {
        var from = date.atStartOfDay(CLINIC_ZONE).toInstant();
        var to = date.plusDays(1).atStartOfDay(CLINIC_ZONE).toInstant();
        var appts = appointmentRepository.findBySlotStartBetweenOrderBySlotStart(from, to);
        if (appts.isEmpty()) return List.of();

        var docsByAppt = documentRepository
            .findByAppointmentIdInOrderByCreatedAt(appts.stream().map(Appointment::getId).toList())
            .stream().collect(Collectors.groupingBy(AppointmentDocument::getAppointmentId));
        var profiles = profileRepository
            .findAllById(appts.stream().map(Appointment::getProfileId).distinct().toList())
            .stream().collect(Collectors.toMap(p -> p.getId(), p -> p));

        return appts.stream().map(a -> {
            var p = profiles.get(a.getProfileId());
            return new DoctorAppointment(a.getId(), a.getProfileId(), a.getSlotStart(), a.getSlotEnd(),
                a.getStatus(), a.getNote(),
                p != null ? p.getFullName() : null,
                p != null ? p.getPhone() : null,
                toDocDtos(docsByAppt.getOrDefault(a.getId(), List.of())));
        }).toList();
    }

    @Transactional
    public void updateStatus(UUID appointmentId, AppointmentStatus next) {
        var appt = appointmentRepository.findById(appointmentId)
            .orElseThrow(() -> ApiException.notFound("Không tìm thấy lịch hẹn"));
        if (!appt.getStatus().canTransitionTo(next)) {
            throw ApiException.conflict(
                "Không thể chuyển từ " + appt.getStatus() + " sang " + next);
        }
        appt.setStatus(next);
        appointmentRepository.save(appt);
    }

    // ===== Lịch làm việc (Doctor cấu hình) =====

    @Transactional(readOnly = true)
    public List<AvailabilityRow> getSchedule() {
        return availabilityRepository.findAllByOrderByWeekdayAscStartTimeAsc().stream()
            .map(a -> new AvailabilityRow(a.getWeekday(), a.getStartTime(),
                a.getEndTime(), a.getSlotMinutes()))
            .toList();
    }

    /** Thay toàn bộ lịch làm việc — đơn giản và không để sót dòng mồ côi. */
    @Transactional
    public List<AvailabilityRow> replaceSchedule(List<AvailabilityRow> rows) {
        for (var r : rows) {
            if (!r.endTime().isAfter(r.startTime())) {
                throw ApiException.badRequest("Giờ kết thúc phải sau giờ bắt đầu");
            }
        }
        availabilityRepository.deleteAll();
        availabilityRepository.saveAll(rows.stream().map(r -> {
            var a = new DoctorAvailability();
            a.setWeekday(r.weekday());
            a.setStartTime(r.startTime());
            a.setEndTime(r.endTime());
            a.setSlotMinutes(r.slotMinutes());
            return a;
        }).toList());
        return getSchedule();
    }

    // ===== Helpers =====

    private Appointment findOwned(UUID profileId, UUID appointmentId) {
        return appointmentRepository.findByIdAndProfileId(appointmentId, profileId)
            .orElseThrow(() -> ApiException.notFound("Không tìm thấy lịch hẹn"));
    }

    private PatientAppointment toPatient(Appointment a) {
        return new PatientAppointment(a.getId(), a.getSlotStart(), a.getSlotEnd(),
            a.getStatus(), a.getNote(),
            toDocDtos(documentRepository.findByAppointmentIdOrderByCreatedAt(a.getId())));
    }

    private List<DocumentDto> toDocDtos(List<AppointmentDocument> docs) {
        return docs.stream()
            .map(d -> new DocumentDto(d.getId(),
                storage.signedUrl(d.getImagePath(), SIGNED_URL_TTL_SECONDS)))
            .toList();
    }
}
