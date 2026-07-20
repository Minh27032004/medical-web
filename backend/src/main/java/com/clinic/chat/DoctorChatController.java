package com.clinic.chat;

import com.clinic.medicine.MedicineService;
import com.clinic.patient.Patient;
import com.clinic.patient.PatientService;
import com.clinic.visit.VisitService;
import tools.jackson.databind.ObjectMapper;
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
 */
@Slf4j
@RestController
@RequestMapping("/api/doctor/chat")
@RequiredArgsConstructor
public class DoctorChatController {

    private final GeminiClient gemini;
    private final VisitService visitService;
    private final MedicineService medicineService;
    private final PatientService patientService;
    private final ChatMessageRepository chatRepo;
    private final ObjectMapper objectMapper;

    public record ChatRequest(String question) {}

    public record ChatResponse(String intent, String title, List<Map<String, Object>> rows,
                               String message) {}

    public record HistoryItem(String question, String intent, String answerSummary, Instant createdAt) {}

    /** Intent có dùng khoảng ngày — quyết định có lưu param_from/to để cấp ngữ cảnh lượt sau. */
    private static final Set<String> DATE_INTENTS = Set.of(
        "VISITS_BY_DATE", "INJECTION_BY_DATE", "VISIT_COUNT", "INJECTION_COUNT");

    private static final String CLASSIFY_PROMPT = """
        Bạn là bộ phân loại câu hỏi cho hệ quản lý phòng khám. Hôm nay là %s (giờ Việt Nam).
        Trả về DUY NHẤT một JSON: {"intent": "...", "from": "YYYY-MM-DD", "to": "YYYY-MM-DD", "name": "..."}
        Các intent hợp lệ:
        - VISITS_BY_DATE: danh sách bệnh nhân/lần khám trong một khoảng ngày (from, to)
        - INJECTION_BY_DATE: các lần khám CÓ TIÊM thuốc trong khoảng ngày (from, to)
        - PATIENT_HISTORY: lịch sử khám (danh sách) của MỘT bệnh nhân (name)
        - LAST_VISIT: lần khám GẦN NHẤT của MỘT bệnh nhân là khi nào (name)
        - VISIT_COUNT: ĐẾM số lần khám của MỘT bệnh nhân trong khoảng (name, from, to)
        - INJECTION_COUNT: ĐẾM số lần CÓ TIÊM của MỘT bệnh nhân trong khoảng (name, from, to)
        - MEDICINE_STOCK: tồn kho của MỘT thuốc theo tên (name)
        - LOW_STOCK: những thuốc đang dưới ngưỡng cảnh báo (sắp hết)
        - LOWEST_STOCK: thuốc nào tồn THẤP NHẤT / ít nhất và còn bao nhiêu
        - UNKNOWN: không thuộc các loại trên
        Quy đổi mốc thời gian tương đối (hôm nay, hôm qua, tuần này, tháng này...) thành ngày cụ thể.
        Trường không dùng thì bỏ qua. Không thêm chữ nào ngoài JSON.
        """;

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
        var context = buildContext(chatRepo.findTop5ByDoctorIdOrderByCreatedAtDesc(doctorId));

        String intent = "UNKNOWN";
        LocalDate from = today;
        LocalDate to = today;
        String name = "";
        try {
            var raw = gemini.generate(CLASSIFY_PROMPT.formatted(today),
                context + "Câu hỏi hiện tại: " + req.question());
            var json = objectMapper.readTree(raw);
            intent = json.path("intent").asText("UNKNOWN");
            if (json.hasNonNull("from")) from = LocalDate.parse(json.get("from").asText());
            if (json.hasNonNull("to")) to = LocalDate.parse(json.get("to").asText());
            if (json.hasNonNull("name")) name = json.get("name").asText("");
        } catch (Exception e) {
            log.warn("Không parse được intent, coi như UNKNOWN", e);
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

        persist(doctorId, req.question().trim(), intent, name, from, to, resp);
        return resp;
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

    private void persist(UUID doctorId, String question, String intent, String name,
                         LocalDate from, LocalDate to, ChatResponse resp) {
        try {
            var m = new ChatMessage();
            m.setDoctorId(doctorId);
            m.setQuestion(question);
            m.setIntent(intent);
            m.setParamName(name == null || name.isBlank() ? null : name);
            boolean dateBased = DATE_INTENTS.contains(intent);
            m.setParamFrom(dateBased ? from : null);
            m.setParamTo(dateBased ? to : null);
            m.setAnswerSummary(resp.title() != null ? resp.title() : resp.message());
            chatRepo.save(m);
        } catch (Exception e) {
            log.warn("Không lưu được lịch sử chat (bỏ qua)", e); // lỗi lưu không được làm hỏng câu trả lời
        }
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
        var rows = new ArrayList<Map<String, Object>>();
        for (var v : visitService.visitsOfPatient(doctorId, p.get().getId())) {
            rows.add(rowOf(v));
        }
        return new ChatResponse("PATIENT_HISTORY",
            "Lịch sử khám của " + p.get().getFullName() + " — " + rows.size() + " lần",
            rows, null);
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
