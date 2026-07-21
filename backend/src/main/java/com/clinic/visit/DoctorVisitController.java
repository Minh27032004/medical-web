package com.clinic.visit;

import com.clinic.common.Pageables;
import com.clinic.visit.VisitService.CreateRequest;
import com.clinic.visit.VisitService.ItemDto;
import com.clinic.visit.VisitService.VisitDetail;
import com.clinic.visit.VisitService.VisitRow;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/doctor")
@RequiredArgsConstructor
public class DoctorVisitController {

    private final VisitService visitService;

    private static UUID doctorId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }

    /** Tạo lần khám + đơn thuốc + trừ kho — một transaction. */
    @PostMapping("/visits")
    @ResponseStatus(HttpStatus.CREATED)
    public VisitDetail create(@AuthenticationPrincipal Jwt jwt, @RequestBody CreateRequest req) {
        return visitService.create(doctorId(jwt), req);
    }

    /**
     * Sửa lần khám = thay thế: hoàn kho + xóa mềm bản cũ rồi tạo bản mới, một transaction.
     * doctorId luôn lấy từ JWT — id trong path chỉ dùng để TÌM, quyền sở hữu do service kiểm.
     */
    @PostMapping("/visits/{id}/replace")
    @ResponseStatus(HttpStatus.CREATED)
    public VisitDetail replace(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                               @RequestBody CreateRequest req) {
        return visitService.replace(doctorId(jwt), id, req);
    }

    /**
     * Xóa mềm lần khám (V12). restoreStock do bác sĩ tick trên popup xác nhận:
     * true = hoàn thuốc về kho (xóa vì nhập nhầm), false = giữ nguyên tồn (thuốc đã phát).
     */
    @DeleteMapping("/visits/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteVisit(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                            @RequestParam(defaultValue = "false") boolean restoreStock) {
        visitService.softDelete(doctorId(jwt), id, restoreStock);
    }

    /** Lịch sử khám — mặc định 30 ngày gần nhất, filter theo ngày (§5.6). */
    @GetMapping("/visits")
    public List<VisitRow> history(
        @AuthenticationPrincipal Jwt jwt,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        return visitService.history(doctorId(jwt), from, to);
    }

    @GetMapping("/visits/{id}")
    public VisitDetail detail(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return visitService.detail(doctorId(jwt), id);
    }

    /** Lịch sử khám của một bệnh nhân — phân trang, mới → cũ. */
    @GetMapping("/patients/{patientId}/visits")
    public Page<VisitRow> visitsOfPatient(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID patientId,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        return visitService.visitsOfPatient(doctorId(jwt), patientId, Pageables.of(page, size, 100));
    }

    /** Nút "Tạo lại đơn gần nhất" — trả các dòng thuốc của lần khám trước để FE điền form. */
    @GetMapping("/patients/{patientId}/last-prescription")
    public List<ItemDto> lastPrescription(@AuthenticationPrincipal Jwt jwt,
                                          @PathVariable UUID patientId) {
        return visitService.lastPrescriptionItems(doctorId(jwt), patientId);
    }

    @PostMapping("/prescriptions/{id}/printed")
    public void markPrinted(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        visitService.markPrinted(doctorId(jwt), id);
    }
}
