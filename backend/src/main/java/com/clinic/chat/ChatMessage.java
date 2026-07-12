package com.clinic.chat;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;

/**
 * Một lượt hỏi–đáp của trợ lý (V9). Lưu để hiển thị lại VÀ cấp ngữ cảnh cho lượt sau
 * (kế thừa "anh A"/khoảng thời gian). KHÔNG lưu bảng kết quả — chỉ tham số + tóm tắt.
 */
@Entity
@Table(name = "chat_messages")
@Getter
@Setter
@NoArgsConstructor
public class ChatMessage {

    @Id
    @GeneratedValue
    @UuidGenerator
    private UUID id;

    @Column(name = "doctor_id", nullable = false, updatable = false)
    private UUID doctorId;

    @Column(nullable = false)
    private String question;

    private String intent;

    /** Tên bệnh nhân/thuốc đã trích — để lượt sau kế thừa đối tượng. */
    @Column(name = "param_name")
    private String paramName;

    @Column(name = "param_from")
    private LocalDate paramFrom;

    @Column(name = "param_to")
    private LocalDate paramTo;

    @Column(name = "answer_summary")
    private String answerSummary;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
    }
}
