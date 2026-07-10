package com.clinic.appointment;

import com.clinic.appointment.AppointmentDtos.BookRequest;
import com.clinic.appointment.AppointmentDtos.DocumentDto;
import com.clinic.appointment.AppointmentDtos.PatientAppointment;
import com.clinic.common.ApiException;
import jakarta.validation.Valid;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/me/appointments")
@RequiredArgsConstructor
public class MeAppointmentController {

    private static final Map<String, String> ALLOWED_TYPES = Map.of(
        "image/jpeg", "jpg",
        "image/png", "png",
        "image/webp", "webp"
    );
    private static final long MAX_SIZE_BYTES = 5 * 1024 * 1024;

    private final AppointmentService appointmentService;

    private static UUID userId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PatientAppointment book(
        @AuthenticationPrincipal Jwt jwt,
        @Valid @RequestBody BookRequest req
    ) {
        return appointmentService.book(userId(jwt), req.slotStart(), req.note());
    }

    @GetMapping
    public List<PatientAppointment> listMine(@AuthenticationPrincipal Jwt jwt) {
        return appointmentService.listMine(userId(jwt));
    }

    @PostMapping("/{id}/cancel")
    public PatientAppointment cancel(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return appointmentService.cancelMine(userId(jwt), id);
    }

    /** Gửi ảnh giấy khám sức khỏe cho bác sĩ xem trước buổi khám. */
    @PostMapping(value = "/{id}/documents", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public DocumentDto uploadDocument(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID id,
        @RequestParam("file") MultipartFile file
    ) {
        if (file.isEmpty()) throw ApiException.badRequest("File rỗng");
        if (file.getSize() > MAX_SIZE_BYTES) throw ApiException.badRequest("Ảnh tối đa 5MB");
        var ext = ALLOWED_TYPES.get(file.getContentType());
        if (ext == null) throw ApiException.badRequest("Chỉ nhận ảnh JPEG, PNG hoặc WebP");
        try {
            return appointmentService.addDocument(userId(jwt), id,
                file.getBytes(), file.getContentType(), ext);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
