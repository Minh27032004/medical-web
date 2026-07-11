package com.clinic.chat;

import com.clinic.medicine.MedicineService;
import com.clinic.visit.VisitService;
import tools.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Chat nội bộ (§5.7): LLM CHỈ trả {intent, params} JSON → backend map vào query template
 * whitelist, luôn ràng buộc doctor_id. LLM không bao giờ chạm DB.
 */
@Slf4j
@RestController
@RequestMapping("/api/doctor/chat")
@RequiredArgsConstructor
public class DoctorChatController {

    private final GeminiClient gemini;
    private final VisitService visitService;
    private final MedicineService medicineService;
    private final ObjectMapper objectMapper;

    public record ChatRequest(String question) {}

    public record ChatResponse(String intent, String title, List<Map<String, Object>> rows,
                               String message) {}

    private static final String CLASSIFY_PROMPT = """
        Bạn là bộ phân loại câu hỏi cho hệ quản lý phòng khám. Hôm nay là %s (giờ Việt Nam).
        Trả về DUY NHẤT một JSON: {"intent": "...", "from": "YYYY-MM-DD", "to": "YYYY-MM-DD", "name": "..."}
        Các intent hợp lệ:
        - VISITS_BY_DATE: hỏi danh sách bệnh nhân/lần khám trong một khoảng ngày (from, to)
        - INJECTION_BY_DATE: hỏi các đơn/lần khám CÓ TIÊM thuốc trong khoảng ngày (from, to)
        - PATIENT_HISTORY: hỏi lịch sử khám của MỘT bệnh nhân cụ thể (name = tên bệnh nhân)
        - MEDICINE_STOCK: hỏi tồn kho của MỘT thuốc (name = tên thuốc)
        - LOW_STOCK: hỏi thuốc nào sắp hết / cần nhập thêm
        - UNKNOWN: không thuộc các loại trên
        Quy đổi mốc thời gian tương đối (hôm nay, hôm qua, tuần này, tháng này...) thành ngày cụ thể.
        Trường không dùng thì bỏ qua. Không thêm chữ nào ngoài JSON.
        """;

    @PostMapping
    public ChatResponse ask(@AuthenticationPrincipal Jwt jwt, @RequestBody ChatRequest req) {
        var doctorId = UUID.fromString(jwt.getSubject());
        if (req.question() == null || req.question().isBlank()) {
            return new ChatResponse("UNKNOWN", null, List.of(), "Bạn muốn hỏi gì?");
        }

        var today = LocalDate.now(VisitService.CLINIC_ZONE);
        String intent = "UNKNOWN";
        LocalDate from = today;
        LocalDate to = today;
        String name = "";
        try {
            var raw = gemini.generate(CLASSIFY_PROMPT.formatted(today), req.question());
            var json = objectMapper.readTree(raw);
            intent = json.path("intent").asText("UNKNOWN");
            if (json.hasNonNull("from")) from = LocalDate.parse(json.get("from").asText());
            if (json.hasNonNull("to")) to = LocalDate.parse(json.get("to").asText());
            if (json.hasNonNull("name")) name = json.get("name").asText("");
        } catch (Exception e) {
            log.warn("Không parse được intent, coi như UNKNOWN", e);
        }

        // Whitelist intent → query template (luôn theo doctorId)
        return switch (intent) {
            case "VISITS_BY_DATE" -> visitsResponse(doctorId, from, to, false);
            case "INJECTION_BY_DATE" -> visitsResponse(doctorId, from, to, true);
            case "PATIENT_HISTORY" -> patientHistory(doctorId, name);
            case "MEDICINE_STOCK" -> medicineStock(doctorId, name);
            case "LOW_STOCK" -> lowStock(doctorId);
            default -> new ChatResponse("UNKNOWN", null, List.of(),
                "Tôi trả lời được các câu như: \"bệnh nhân hôm nay\", \"đơn có tiêm thuốc hôm qua\", "
                + "\"lịch sử khám của <tên>\", \"tồn kho <tên thuốc>\", \"thuốc nào sắp hết\".");
        };
    }

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
        if (name.isBlank()) {
            return new ChatResponse("PATIENT_HISTORY", null, List.of(), "Bạn muốn xem lịch sử của bệnh nhân tên gì?");
        }
        // tìm trong 1 năm gần nhất theo tên (template cứng, vẫn lọc doctorId)
        var rows = new ArrayList<Map<String, Object>>();
        var today = LocalDate.now(VisitService.CLINIC_ZONE);
        for (var v : visitService.history(doctorId, today.minusYears(1), today)) {
            if (v.patientName() != null
                && v.patientName().toLowerCase().contains(name.toLowerCase())) {
                rows.add(rowOf(v));
            }
        }
        return new ChatResponse("PATIENT_HISTORY",
            "Lịch sử khám của \"" + name + "\" (1 năm gần nhất) — " + rows.size() + " lần", rows, null);
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
