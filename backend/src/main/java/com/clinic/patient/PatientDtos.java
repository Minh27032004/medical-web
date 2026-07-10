package com.clinic.patient;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import java.time.Instant;
import java.util.UUID;

public class PatientDtos {

    private PatientDtos() {}

    public record UpsertRequest(
        @NotBlank(message = "Thiếu tên bệnh nhân") String fullName,
        String phone,
        @Min(0) @Max(150) Integer age,
        String photoPath,
        String note,
        UUID profileId // liên kết tài khoản (lấy từ lịch hẹn) — có thể null với walk-in
    ) {}

    public record PatientDto(
        UUID id,
        String fullName,
        String phone,
        Integer age,
        String photoUrl, // signed URL
        String note,
        UUID profileId,
        Instant createdAt
    ) {}
}
