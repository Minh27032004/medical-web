package com.clinic.chat;

import com.clinic.medicine.MedicineService;
import com.clinic.patient.Patient;
import com.clinic.patient.PatientService;
import com.clinic.visit.VisitService;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Chat nội bộ (§5.7): LLM CHỈ trả {intent, params} JSON → backend map vào query template
 * whitelist, luôn ràng buộc doctor_id. LLM không bao giờ chạm DB.
 * Có NGỮ CẢNH: nạp 5 lượt gần nhất (V9) để hiểu câu hỏi nối tiếp ("... còn mấy lần tiêm?").
 *
 * ĐƯỜNG ĐI CỦA MỘT CÂU HỎI (đo trên production: mỗi round-trip DB ~100ms, Gemini ~740ms):
 *   1. `intent` có sẵn trong request (bác sĩ bấm chip gợi ý) → KHÔNG gọi Gemini, không nạp
 *      ngữ cảnh. Chip là câu cố định, intent đã biết chắc — hỏi lại model là tự trả 740ms
 *      cho một thứ mình đã biết.
 *   2. Không có → IntentClassifier (có cache) mới gọi Gemini.
 * Ngữ cảnh chỉ nạp khi phiên ĐÃ có lượt trước (turnIndex > 0) — câu đầu phiên thì bảng
 * chat_messages chắc chắn chưa có gì trong phiên này, query đi cũng chỉ tốn 100ms để nhận
 * về danh sách rỗng.
 */
@Slf4j
@RestController
@RequestMapping("/api/doctor/chat")
@RequiredArgsConstructor
public class DoctorChatController {

    private final IntentClassifier classifier;
    private final VisitService visitService;
    private final MedicineService medicineService;
    private final PatientService patientService;
    private final ChatMessageRepository chatRepo;
    private final ChatHistoryService historyService;

    /** Trần số dòng lịch sử khám trả về trong một câu trả lời chat. */
    private static final int MAX_HISTORY_ROWS = 50;

    /**
     * Yêu cầu chat.
     *
     * @param sessionId (V16) FE sinh mỗi lần MỞ chat — ngữ cảnh chỉ kế thừa trong cùng phiên.
     * @param intent    TẦNG 0: chip gợi ý gửi thẳng intent đã biết, bỏ qua LLM. Chỉ nhận giá
     *                  trị trong {@link #DIRECT_INTENTS}; sai thì rơi về phân loại bình thường.
     * @param name      tên bệnh nhân/thuốc đi kèm chip (chip có ô nhập).
     * @param range     khoảng ngày của chip, dạng từ khóa (TODAY/THIS_MONTH) — backend tự quy
     *                  ra ngày. KHÔNG cho FE gửi ngày cụ thể: mốc thời gian phải tính theo
     *                  giờ phòng khám ở server, không theo đồng hồ máy bác sĩ.
     * @param turnIndex số lượt đã hỏi trong phiên; 0 = câu đầu → khỏi nạp ngữ cảnh.
     */
    public record ChatRequest(String question, UUID sessionId, String intent, String name,
                              String range, Integer turnIndex) {}

    public record ChatResponse(String intent, String title, List<Map<String, Object>> rows,
                               String message) {}

    public record HistoryItem(String question, String intent, String answerSummary, Instant createdAt) {}

    /**
     * Intent mà FE được phép chỉ định thẳng. Đây KHÔNG phải lỗ hổng: mỗi intent vẫn đi qua
     * đúng query template cũ và vẫn lọc theo doctorId lấy từ JWT — bác sĩ tự gõ câu hỏi cũng
     * ra được đúng chừng đó intent. Whitelist ở đây chỉ để một giá trị lạ không lọt vào switch.
     */
    private static final Set<String> DIRECT_INTENTS = Set.of(
        "VISITS_BY_DATE", "INJECTION_BY_DATE", "PATIENT_HISTORY", "LAST_VISIT",
        "VISIT_COUNT", "INJECTION_COUNT", "MEDICINE_STOCK", "LOW_STOCK", "LOWEST_STOCK");

    @GetMapping("/history")
    public List<HistoryItem> history(@AuthenticationPrincipal Jwt jwt) {
        var doctorId = UUID.fromString(jwt.getSubject());
        var list = new ArrayList<>(chatRepo.findTop5ByDoctorIdOrderByCreatedAtDesc(doctorId));
        Collections.reverse(list); // cũ → mới để render tuần tự
        return list.stream()
            .map(m -> new HistoryItem(m.getQuestion(), m.getIntent(), m.getAnswerSummary(), m.getCreatedAt()))
            .toList();
    }

    @PostMapping
    public ChatResponse ask(@AuthenticationPrincipal Jwt jwt, @RequestBody ChatRequest req) {
        var doctorId = UUID.fromString(jwt.getSubject());
        if (req.question() == null || req.question().isBlank()) {
            return new ChatResponse("UNKNOWN", null, List.of(), "Bạn muốn hỏi gì?");
        }

        var today = LocalDate.now(VisitService.CLINIC_ZONE);

        String intent;
        LocalDate from;
        LocalDate to;
        String name;

        var direct = req.intent() != null && DIRECT_INTENTS.contains(req.intent());
        if (direct) {
            // TẦNG 0 — bác sĩ bấm chip gợi ý: intent đã biết chắc, không gọi Gemini, không nạp
            // ngữ cảnh. Cắt trọn ~740ms (LLM) + ~100ms (query ngữ cảnh) khỏi đường đi.
            intent = req.intent();
            name = req.name() == null ? "" : req.name().trim();
            var span = rangeOf(req.range(), today);
            from = span[0];
            to = span[1];
        } else {
            // Ngữ cảnh chỉ có ý nghĩa từ lượt thứ hai trở đi. Không có sessionId (client cũ)
            // thì KHÔNG lấy ngữ cảnh — thà mất tính năng hỏi nối tiếp còn hơn kế thừa nhầm
            // đối tượng của phiên khác.
            // turnIndex thiếu = tab đang chạy bản JS cũ (chưa reload sau deploy): giữ nguyên
            // hành vi cũ là nạp ngữ cảnh, đừng lặng lẽ tắt tính năng hỏi nối tiếp của họ.
            var needContext = req.sessionId() != null
                && (req.turnIndex() == null || req.turnIndex() > 0);
            var context = needContext
                ? buildContext(chatRepo.findTop5ByDoctorIdAndSessionIdOrderByCreatedAtDesc(
                    doctorId, req.sessionId()))
                : "";
            var c = classifier.classify(req.question(), context, today);
            intent = c.intent();
            from = c.from();
            to = c.to();
            name = c.name();
        }

        // Whitelist intent → query template (luôn theo doctorId)
        var resp = switch (intent) {
            case "VISITS_BY_DATE" -> visitsResponse(doctorId, from, to, false);
            case "INJECTION_BY_DATE" -> visitsResponse(doctorId, from, to, true);
            case "PATIENT_HISTORY" -> patientHistory(doctorId, name);
            case "LAST_VISIT" -> lastVisit(doctorId, name);
            case "VISIT_COUNT" -> visitCount(doctorId, name, from, to, false);
            case "INJECTION_COUNT" -> visitCount(doctorId, name, from, to, true);
            case "MEDICINE_STOCK" -> medicineStock(doctorId, name);
            case "LOW_STOCK" -> lowStock(doctorId);
            case "LOWEST_STOCK" -> lowestStock(doctorId);
            default -> new ChatResponse("UNKNOWN", null, List.of(),
                "Tôi trả lời được ví dụ: \"bệnh nhân hôm nay\", \"đơn có tiêm hôm qua\", "
                + "\"lịch sử khám của <tên>\", \"<tên> khám gần nhất khi nào\", "
                + "\"tháng này <tên> khám mấy lần\", \"tồn kho <thuốc>\", "
                + "\"thuốc nào sắp hết\", \"thuốc nào tồn thấp nhất\".");
        };

        // Ghi nhật ký CHẠY NGẦM — trả lời xong rồi mới lưu, bác sĩ không chờ thêm INSERT.
        historyService.record(doctorId, req.sessionId(), req.question().trim(), intent, name,
            from, to, resp.title() != null ? resp.title() : resp.message());
        return resp;
    }

    /**
     * Từ khóa khoảng ngày của chip → cặp [from, to] tính theo giờ phòng khám.
     * Giá trị lạ thì coi như hôm nay — chip chỉ sinh ra hai giá trị này.
     */
    private static LocalDate[] rangeOf(String range, LocalDate today) {
        if ("THIS_MONTH".equals(range)) {
            return new LocalDate[] {today.withDayOfMonth(1), today};
        }
        return new LocalDate[] {today, today};
    }

    /** Ghép ngữ cảnh 5 lượt gần nhất thành text cho Gemini để hiểu câu hỏi nối tiếp. */
    private String buildContext(List<ChatMessage> recentDesc) {
        if (recentDesc.isEmpty()) return "";
        var list = new ArrayList<>(recentDesc);
        Collections.reverse(list); // cũ → mới
        var sb = new StringBuilder(
            "Ngữ cảnh các lượt hỏi trước (cũ→mới) — dùng để hiểu câu hỏi hiện tại:\n");
        for (var m : list) {
            sb.append("- \"").append(m.getQuestion()).append("\" → intent=").append(m.getIntent());
            if (m.getParamName() != null) sb.append(", đối tượng=").append(m.getParamName());
            if (m.getParamFrom() != null) {
                sb.append(", khoảng ").append(m.getParamFrom()).append("..").append(m.getParamTo());
            }
            sb.append("\n");
        }
        sb.append("Nếu câu hỏi hiện tại nói TIẾP mà KHÔNG nêu tên/đối tượng, hãy KẾ THỪA 'đối tượng' "
            + "của lượt gần nhất có nó; tương tự với khoảng thời gian.\n\n");
        return sb.toString();
    }

    // ===== Handlers (mỗi cái là 1 "template" query, luôn lọc doctorId) =====

    private ChatResponse visitsResponse(UUID doctorId, LocalDate from, LocalDate to, boolean onlyInjection) {
        var rows = new ArrayList<Map<String, Object>>();
        for (var v : visitService.history(doctorId, from, to)) {
            if (onlyInjection && !v.hasInjection()) continue;
            rows.add(rowOf(v));
        }
        var title = (onlyInjection ? "Lần khám CÓ TIÊM " : "Lần khám ")
            + "từ " + from + " đến " + to + " — " + rows.size() + " kết quả";
        return new ChatResponse(onlyInjection ? "INJECTION_BY_DATE" : "VISITS_BY_DATE",
            title, rows, null);
    }

    private ChatResponse patientHistory(UUID doctorId, String name) {
        var p = resolvePatient(doctorId, name);
        if (p.isEmpty()) return notFoundPatient(name);
        // Truy vấn thẳng theo patientId. Trước đây kéo TOÀN BỘ lần khám 1 năm của phòng khám
        // (kèm enrich tên bệnh nhân + cờ tiêm cho từng dòng) rồi lọc trong Java — tốn vô ích.
        // Khung chat không phải chỗ đọc trăm dòng: lấy 50 lần gần nhất, nhưng vẫn nói ĐÚNG
        // tổng số lần khám để bác sĩ biết còn nữa và mở hồ sơ bệnh nhân xem tiếp.
        var page = visitService.visitsOfPatient(doctorId, p.get().getId(), PageRequest.of(0, MAX_HISTORY_ROWS));
        var rows = new ArrayList<Map<String, Object>>();
        for (var v : page.getContent()) {
            rows.add(rowOf(v));
        }
        var title = "Lịch sử khám của " + p.get().getFullName()
            + " — " + page.getTotalElements() + " lần";
        if (page.getTotalElements() > rows.size()) {
            title += " (hiện " + rows.size() + " lần gần nhất)";
        }
        return new ChatResponse("PATIENT_HISTORY", title, rows, null);
    }

    private ChatResponse lastVisit(UUID doctorId, String name) {
        var p = resolvePatient(doctorId, name);
        if (p.isEmpty()) return notFoundPatient(name);
        var last = visitService.lastVisit(doctorId, p.get().getId());
        if (last.isEmpty()) {
            return new ChatResponse("LAST_VISIT", null, List.of(),
                "Chưa có lần khám nào cho " + p.get().getFullName() + ".");
        }
        var v = last.get();
        var d = v.visitDate().atZone(VisitService.CLINIC_ZONE).toLocalDate();
        return new ChatResponse("LAST_VISIT", "Lần khám gần nhất của " + p.get().getFullName(),
            List.of(rowOf(v)),
            p.get().getFullName() + " khám gần nhất ngày " + d
                + " — " + v.diagnosisCode() + " " + v.diagnosisName() + ".");
    }

    private ChatResponse visitCount(UUID doctorId, String name, LocalDate from, LocalDate to,
                                    boolean onlyInjection) {
        var p = resolvePatient(doctorId, name);
        if (p.isEmpty()) return notFoundPatient(name);
        int n = onlyInjection
            ? visitService.countInjectionVisits(doctorId, p.get().getId(), from, to)
            : visitService.countVisits(doctorId, p.get().getId(), from, to);
        var what = onlyInjection ? "lần có tiêm thuốc" : "lần khám";
        return new ChatResponse(onlyInjection ? "INJECTION_COUNT" : "VISIT_COUNT", null, List.of(),
            p.get().getFullName() + " có " + n + " " + what + " từ " + from + " đến " + to + ".");
    }

    private ChatResponse medicineStock(UUID doctorId, String name) {
        if (name.isBlank()) {
            return new ChatResponse("MEDICINE_STOCK", null, List.of(), "Bạn muốn xem tồn kho thuốc nào?");
        }
        var rows = new ArrayList<Map<String, Object>>();
        for (var m : medicineService.searchEntities(doctorId, name, 10)) {
            var r = new LinkedHashMap<String, Object>();
            r.put("Thuốc", m.getName());
            r.put("Tồn kho", MedicineService.stockDisplay(m));
            r.put("Sắp hết", m.getStockBaseQty().intValue() < m.getLowStockThreshold() ? "⚠️ CÓ" : "Không");
            rows.add(r);
        }
        return new ChatResponse("MEDICINE_STOCK", "Tồn kho khớp \"" + name + "\"", rows, null);
    }

    private ChatResponse lowStock(UUID doctorId) {
        var rows = new ArrayList<Map<String, Object>>();
        for (var m : medicineService.lowStock(doctorId)) {
            var r = new LinkedHashMap<String, Object>();
            r.put("Thuốc", m.name());
            r.put("Tồn kho", m.stockDisplay());
            r.put("Ngưỡng", m.lowStockThreshold());
            rows.add(r);
        }
        return new ChatResponse("LOW_STOCK", "Thuốc sắp hết (" + rows.size() + ")", rows,
            rows.isEmpty() ? "Không có thuốc nào dưới ngưỡng cảnh báo 👍" : null);
    }

    private ChatResponse lowestStock(UUID doctorId) {
        var info = medicineService.lowestStock(doctorId);
        if (info.isEmpty()) {
            return new ChatResponse("LOWEST_STOCK", null, List.of(), "Kho chưa có thuốc nào.");
        }
        var i = info.get();
        var row = new LinkedHashMap<String, Object>();
        row.put("Thuốc", i.name());
        row.put("Tồn kho", i.stockDisplay());
        row.put("Ngưỡng cảnh báo", i.threshold());
        row.put("Dưới ngưỡng", i.below() ? "⚠️ CÓ" : "Không");
        return new ChatResponse("LOWEST_STOCK", "Thuốc tồn thấp nhất", List.of(row),
            "Thuốc tồn thấp nhất là " + i.name() + " — còn " + i.stockDisplay()
                + (i.below() ? " (dưới ngưỡng " + i.threshold() + ")" : "") + ".");
    }

    // ===== Helpers =====

    /** Tra bệnh nhân theo tên (lấy khớp đầu tiên). Rỗng nếu không có tên hoặc không tìm thấy. */
    private Optional<Patient> resolvePatient(UUID doctorId, String name) {
        if (name == null || name.isBlank()) return Optional.empty();
        var matches = patientService.searchEntities(doctorId, name.trim(), 1);
        return matches.isEmpty() ? Optional.empty() : Optional.of(matches.get(0));
    }

    private static ChatResponse notFoundPatient(String name) {
        return new ChatResponse("UNKNOWN", null, List.of(),
            name == null || name.isBlank()
                ? "Bạn muốn hỏi về bệnh nhân nào?"
                : "Không tìm thấy bệnh nhân tên \"" + name + "\".");
    }

    private static Map<String, Object> rowOf(VisitService.VisitRow v) {
        var r = new LinkedHashMap<String, Object>();
        r.put("Ngày giờ", v.visitDate().atZone(VisitService.CLINIC_ZONE)
            .toLocalDateTime().toString().replace('T', ' '));
        r.put("Bệnh nhân", v.patientName());
        r.put("Chẩn đoán", v.diagnosisCode() + " — " + v.diagnosisName());
        r.put("Có tiêm", v.hasInjection() ? "💉 Có" : "Không");
        r.put("visitId", v.id().toString());
        return r;
    }
}
