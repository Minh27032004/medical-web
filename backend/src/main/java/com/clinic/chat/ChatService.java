package com.clinic.chat;

import com.clinic.auth.ProfileRepository;
import com.clinic.common.ApiException;
import com.clinic.kb.KbService;
import com.clinic.order.OrderRepository;
import com.clinic.prescription.PrescriptionService;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ChatService {

    /** Từ khóa nguy hiểm → chuyển bác sĩ NGAY, không để AI trả lời. */
    private static final List<String> RED_FLAGS = List.of(
        "đau ngực", "dau nguc", "khó thở", "kho tho", "hôn mê", "hon me",
        "co giật", "co giat", "chảy máu", "chay mau", "ngất", "ngat",
        "tự tử", "tu tu", "đột quỵ", "dot quy", "tê liệt", "te liet");

    private static final String GUARDRAIL = """
        Bạn là trợ lý ảo của một phòng khám gia đình tại Việt Nam. Trả lời bằng tiếng Việt, ngắn gọn, thân thiện.
        QUY TẮC BẮT BUỘC, KHÔNG CÓ NGOẠI LỆ:
        - KHÔNG chẩn đoán bệnh, KHÔNG kê đơn/gợi ý thuốc, KHÔNG tư vấn liều lượng.
        - Câu hỏi về triệu chứng/bệnh: khuyên đặt lịch khám hoặc bấm "Gặp bác sĩ".
        - Chỉ trả lời dựa trên THÔNG TIN ĐƯỢC CUNG CẤP bên dưới; không biết thì nói không biết và gợi ý hỏi bác sĩ.
        - Không bịa thông tin về giá, giờ làm việc hay dịch vụ.
        """;

    private final ConversationRepository conversationRepository;
    private final ChatMessageRepository messageRepository;
    private final ProfileRepository profileRepository;
    private final OrderRepository orderRepository;
    private final PrescriptionService prescriptionService;
    private final KbService kbService;
    private final GeminiClient gemini;
    private final com.clinic.notification.NotificationService notificationService;

    /** Báo chuông cho bác sĩ khi có người chờ tư vấn trực tiếp. */
    private void notifyDoctorWaiting(UUID profileId, String lastMessage) {
        var name = profileId == null ? "Khách vãng lai"
            : profileRepository.findById(profileId)
                .map(p -> p.getFullName() != null ? p.getFullName() : "Bệnh nhân")
                .orElse("Bệnh nhân");
        notificationService.notify(
            com.clinic.notification.Notification.TYPE_CHAT_WAITING,
            "💬 " + name + " chờ tư vấn",
            lastMessage.length() > 100 ? lastMessage.substring(0, 100) + "…" : lastMessage,
            "/doctor/chat");
    }

    public record MessageDto(UUID id, String sender, String content, Instant createdAt) {}

    public record ChatState(UUID conversationId, String status, List<MessageDto> messages) {}

    // ===== Người dùng (Patient hoặc khách anonKey) =====

    @Transactional(readOnly = true)
    public ChatState getState(UUID profileId, UUID anonKey) {
        var conv = findActive(profileId, anonKey);
        return conv == null
            ? new ChatState(null, Conversation.STATUS_AI, List.of())
            : toState(conv);
    }

    @Transactional
    public ChatState sendMessage(UUID profileId, UUID anonKey, String content) {
        var conv = findActive(profileId, anonKey);
        if (conv == null) {
            conv = new Conversation();
            conv.setProfileId(profileId);
            conv.setAnonKey(profileId == null ? anonKey : null);
            conv = conversationRepository.save(conv);
        }
        save(conv.getId(), ChatMessage.SENDER_USER, content);
        conv.setUpdatedAt(Instant.now());

        // Tầng 2: bác sĩ đang/sắp tiếp quản → AI im lặng
        if (!Conversation.STATUS_AI.equals(conv.getStatus())) {
            conversationRepository.save(conv);
            return toState(conv);
        }

        var normalized = content.toLowerCase(Locale.ROOT);
        if (RED_FLAGS.stream().anyMatch(normalized::contains)) {
            conv.setStatus(Conversation.STATUS_WAITING_DOCTOR);
            notifyDoctorWaiting(profileId, "⚠️ Triệu chứng nguy hiểm: " + content);
            save(conv.getId(), ChatMessage.SENDER_AI,
                "⚠️ Triệu chứng bạn mô tả có thể nghiêm trọng. Tôi đã chuyển cuộc trò chuyện "
                + "cho bác sĩ — bác sĩ sẽ trả lời sớm nhất. Nếu khẩn cấp, hãy gọi 115 hoặc "
                + "đến cơ sở y tế gần nhất ngay.");
            conversationRepository.save(conv);
            return toState(conv);
        }

        var intent = classify(content);
        var reply = switch (intent) {
            case "MEET_DOCTOR" -> {
                if (profileId == null) {
                    yield "Để chat trực tiếp với bác sĩ, bạn vui lòng đăng nhập trước nhé. "
                        + "Sau khi đăng nhập, bấm \"Gặp bác sĩ\" là được.";
                }
                conv.setStatus(Conversation.STATUS_WAITING_DOCTOR);
                notifyDoctorWaiting(profileId, content);
                yield "Tôi đã chuyển cuộc trò chuyện cho bác sĩ. Bác sĩ sẽ trả lời bạn sớm nhất có thể 🙌";
            }
            case "MEDICAL_QUESTION" -> gemini.generate(GUARDRAIL,
                "Người dùng hỏi về triệu chứng/bệnh: \"" + content + "\".\n"
                + "Hãy từ chối chẩn đoán một cách lịch sự và khuyên họ đặt lịch khám "
                + "(mục Đặt lịch khám trên website) hoặc bấm \"Gặp bác sĩ\" để chat trực tiếp.");
            case "MY_ORDERS" -> answerMyOrders(profileId);
            case "MY_PRESCRIPTIONS" -> answerMyPrescriptions(profileId);
            default -> answerWithRag(content); // CLINIC_INFO / MEDICINE_INFO / SMALLTALK
        };

        save(conv.getId(), ChatMessage.SENDER_AI, reply);
        conversationRepository.save(conv);
        return toState(conv);
    }

    /** Patient bấm nút "Gặp bác sĩ". */
    @Transactional
    public ChatState requestDoctor(UUID profileId) {
        var conv = findActive(profileId, null);
        if (conv == null) {
            conv = new Conversation();
            conv.setProfileId(profileId);
            conv = conversationRepository.save(conv);
        }
        if (Conversation.STATUS_AI.equals(conv.getStatus())) {
            conv.setStatus(Conversation.STATUS_WAITING_DOCTOR);
            save(conv.getId(), ChatMessage.SENDER_AI,
                "Đã gửi yêu cầu tới bác sĩ — bác sĩ sẽ trả lời bạn tại đây.");
            conversationRepository.save(conv);
            notifyDoctorWaiting(profileId, "Bệnh nhân bấm nút Nhắn tin trực tiếp");
        }
        return toState(conv);
    }

    // ===== Doctor =====

    public record InboxItem(UUID conversationId, String status, String userName,
                            String lastMessage, Instant updatedAt) {}

    @Transactional(readOnly = true)
    public List<InboxItem> inbox() {
        return conversationRepository.findByStatusInOrderByUpdatedAtDesc(
                List.of(Conversation.STATUS_WAITING_DOCTOR, Conversation.STATUS_WITH_DOCTOR))
            .stream().map(c -> {
                var name = c.getProfileId() != null
                    ? profileRepository.findById(c.getProfileId())
                        .map(p -> p.getFullName() != null ? p.getFullName() : "Bệnh nhân")
                        .orElse("Bệnh nhân")
                    : "Khách vãng lai";
                var last = messageRepository
                    .findFirstByConversationIdOrderByCreatedAtDesc(c.getId())
                    .map(ChatMessage::getContent).orElse("");
                return new InboxItem(c.getId(), c.getStatus(), name,
                    last.length() > 80 ? last.substring(0, 80) + "…" : last,
                    c.getUpdatedAt() != null ? c.getUpdatedAt() : c.getCreatedAt());
            }).toList();
    }

    @Transactional(readOnly = true)
    public ChatState conversationForDoctor(UUID conversationId) {
        return toState(findConversation(conversationId));
    }

    @Transactional
    public ChatState reply(UUID conversationId, String content) {
        var conv = findConversation(conversationId);
        conv.setStatus(Conversation.STATUS_WITH_DOCTOR);
        conv.setUpdatedAt(Instant.now());
        save(conv.getId(), ChatMessage.SENDER_DOCTOR, content);
        conversationRepository.save(conv);
        return toState(conv);
    }

    /** Kết thúc tư vấn — tin nhắn tiếp theo của người dùng sẽ mở hội thoại AI mới. */
    @Transactional
    public void close(UUID conversationId) {
        var conv = findConversation(conversationId);
        conv.setStatus(Conversation.STATUS_CLOSED);
        conversationRepository.save(conv);
    }

    // ===== Nội bộ =====

    private String classify(String content) {
        var result = gemini.generate("""
            Bạn là bộ phân loại intent cho chatbot phòng khám. Đọc tin nhắn và trả về DUY NHẤT
            một nhãn sau, không thêm chữ nào khác:
            - CLINIC_INFO: hỏi về phòng khám, giờ làm việc, địa chỉ, bác sĩ, dịch vụ, giá khám, đặt lịch thế nào
            - MEDICINE_INFO: hỏi về thuốc đang bán, giá thuốc, cách mua
            - MY_ORDERS: hỏi về đơn hàng/lịch sử mua hàng CỦA HỌ
            - MY_PRESCRIPTIONS: hỏi về đơn thuốc/lịch sử khám CỦA HỌ
            - MEDICAL_QUESTION: mô tả triệu chứng, hỏi bệnh gì, hỏi nên uống thuốc gì
            - MEET_DOCTOR: muốn nói chuyện trực tiếp với bác sĩ/người thật
            - SMALLTALK: chào hỏi, cảm ơn, ngoài lề
            """, content).toUpperCase(Locale.ROOT);
        for (var intent : List.of("CLINIC_INFO", "MEDICINE_INFO", "MY_ORDERS",
            "MY_PRESCRIPTIONS", "MEDICAL_QUESTION", "MEET_DOCTOR", "SMALLTALK")) {
            if (result.contains(intent)) return intent;
        }
        return "SMALLTALK";
    }

    private String answerWithRag(String question) {
        var chunks = kbService.search(question);
        var context = chunks.isEmpty()
            ? "(chưa có thông tin trong cơ sở tri thức)"
            : chunks.stream().collect(Collectors.joining("\n---\n"));
        return gemini.generate(GUARDRAIL + "\nTHÔNG TIN PHÒNG KHÁM:\n" + context, question);
    }

    private String answerMyOrders(UUID profileId) {
        if (profileId == null) {
            return "Bạn cần đăng nhập để tôi xem được lịch sử mua hàng của bạn nhé.";
        }
        var orders = orderRepository
            .findByProfileIdAndDeletedAtIsNullOrderByCreatedAtDesc(profileId, PageRequest.of(0, 5))
            .getContent();
        if (orders.isEmpty()) return "Bạn chưa có đơn hàng nào. Ghé Cửa hàng thuốc để mua nhé!";
        var data = orders.stream().map(o -> "- Mã " + o.getPickupCode() + " | " + o.getStatus()
            + " | " + o.getTotalAmount() + "đ | " + o.getItems().size() + " loại thuốc")
            .collect(Collectors.joining("\n"));
        return gemini.generate(GUARDRAIL,
            "Tóm tắt thân thiện các đơn hàng gần nhất của người dùng (dữ liệu thật, không bịa):\n" + data);
    }

    private String answerMyPrescriptions(UUID profileId) {
        if (profileId == null) {
            return "Bạn cần đăng nhập để tôi xem được lịch sử khám của bạn nhé.";
        }
        var prescriptions = prescriptionService.listForProfile(profileId);
        if (prescriptions.isEmpty()) {
            return "Bạn chưa có đơn thuốc nào trong hệ thống. Đơn thuốc sẽ xuất hiện sau khi bác sĩ khám cho bạn.";
        }
        var data = prescriptions.stream().limit(5)
            .map(p -> "- " + p.createdAt() + " | Chẩn đoán: " + p.diagnosis() + " | "
                + p.items().size() + " thuốc")
            .collect(Collectors.joining("\n"));
        return gemini.generate(GUARDRAIL,
            "Tóm tắt thân thiện lịch sử khám của người dùng (dữ liệu thật, không bịa, không tự thêm lời khuyên y tế):\n" + data);
    }

    private Conversation findActive(UUID profileId, UUID anonKey) {
        if (profileId != null) {
            return conversationRepository
                .findFirstByProfileIdAndStatusNotOrderByCreatedAtDesc(profileId, Conversation.STATUS_CLOSED)
                .orElse(null);
        }
        if (anonKey != null) {
            return conversationRepository
                .findFirstByAnonKeyAndStatusNotOrderByCreatedAtDesc(anonKey, Conversation.STATUS_CLOSED)
                .orElse(null);
        }
        throw ApiException.badRequest("Thiếu anonKey cho khách chưa đăng nhập");
    }

    private Conversation findConversation(UUID id) {
        return conversationRepository.findById(id)
            .orElseThrow(() -> ApiException.notFound("Không tìm thấy hội thoại"));
    }

    private void save(UUID conversationId, String sender, String content) {
        var m = new ChatMessage();
        m.setConversationId(conversationId);
        m.setSender(sender);
        m.setContent(content);
        messageRepository.save(m);
    }

    private ChatState toState(Conversation conv) {
        var messages = messageRepository.findTop50ByConversationIdOrderByCreatedAtAsc(conv.getId())
            .stream().map(m -> new MessageDto(m.getId(), m.getSender(), m.getContent(), m.getCreatedAt()))
            .toList();
        return new ChatState(conv.getId(), conv.getStatus(), messages);
    }
}
