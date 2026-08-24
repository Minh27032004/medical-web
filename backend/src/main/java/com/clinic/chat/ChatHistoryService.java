package com.clinic.chat;

import java.time.LocalDate;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

/**
 * Ghi nhật ký hội thoại trợ lý — CHẠY SAU KHI ĐÃ TRẢ LỜI.
 *
 * Trước đây INSERT này nằm trong luồng request: bác sĩ đã có câu trả lời trong tay rồi vẫn
 * phải chờ thêm một round-trip sang DB (đo được ~100ms vì Supabase đặt ở ap-south-1 Mumbai
 * còn backend ở Singapore) chỉ để lưu một dòng nhật ký. Nhật ký hỏng thì mất ngữ cảnh cho
 * lượt hỏi sau, còn câu trả lời vẫn đúng — không đáng để bắt người dùng chờ.
 *
 * Phải là bean RIÊNG: @Async chạy qua proxy Spring, gọi từ chính class chứa nó thì proxy
 * không xen vào được và method vẫn chạy đồng bộ như cũ.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ChatHistoryService {

    /**
     * Intent có dùng khoảng ngày — chỉ những intent này mới lưu from/to làm ngữ cảnh.
     *
     * Ba intent TOP_* phải có mặt: chúng đều chạy trên một khoảng thời gian, và câu hỏi nối
     * tiếp hay gặp nhất chính là đổi khoảng ("thế tháng trước thì sao?"). Thiếu from/to
     * trong ngữ cảnh thì model không biết lượt trước đang xét khoảng nào để mà so.
     */
    private static final Set<String> DATE_INTENTS = Set.of(
        "VISITS_BY_DATE", "INJECTION_BY_DATE", "VISIT_COUNT", "INJECTION_COUNT",
        "TOP_PATIENTS", "TOP_DIAGNOSES", "TOP_MEDICINES");

    private final ChatMessageRepository chatRepo;

    @Async
    public void record(UUID doctorId, UUID sessionId, String question, String intent, String name,
                       LocalDate from, LocalDate to, String answerSummary) {
        try {
            var m = new ChatMessage();
            m.setDoctorId(doctorId);
            m.setSessionId(sessionId);
            m.setQuestion(question);
            m.setIntent(intent);
            m.setParamName(name == null || name.isBlank() ? null : name);
            boolean dateBased = DATE_INTENTS.contains(intent);
            m.setParamFrom(dateBased ? from : null);
            m.setParamTo(dateBased ? to : null);
            m.setAnswerSummary(answerSummary);
            chatRepo.save(m);
        } catch (Exception e) {
            // Chạy ngoài luồng request nên KHÔNG được ném: không ai bắt, và câu trả lời
            // của bác sĩ thì đã gửi đi từ lâu.
            log.warn("Không lưu được lịch sử chat (bỏ qua)", e);
        }
    }
}
