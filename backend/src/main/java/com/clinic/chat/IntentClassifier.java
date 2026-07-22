package com.clinic.chat;

import java.time.LocalDate;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Câu hỏi tiếng Việt → {intent, from, to, name}. Gọi Gemini, CÓ CACHE.
 *
 * Vì sao cache được: với cùng một ngày, phân loại là hàm THUẦN của câu hỏi (đã đặt
 * temperature 0 nên model cũng trả cùng kết quả). Phòng khám hỏi đi hỏi lại đúng vài câu
 * mỗi ngày, mà mỗi lần gọi Gemini đo được ~740ms — trả cùng một số tiền và cùng ngần ấy
 * thời gian cho một câu trả lời đã biết trước là lãng phí.
 *
 * Vì sao KHÔNG cache khi có ngữ cảnh: câu "còn mấy lần tiêm?" chỉ có nghĩa nhờ lượt hỏi
 * trước đó. Cache theo mình câu hỏi sẽ gán nhầm bệnh nhân của phiên khác — đúng kiểu sai
 * lặng lẽ mà V16 đã phải sinh session_id để chặn. Có ngữ cảnh thì luôn hỏi lại model.
 *
 * Vì sao khóa cache KHÔNG có doctorId (nhìn qua thì phạm quy tắc số 1 về cô lập dữ liệu):
 * thứ được cache là {intent, from, to, name} — suy ra HOÀN TOÀN từ chữ trong câu hỏi, không
 * có một byte nào của DB. Bác sĩ B gõ đúng câu của bác sĩ A thì model cũng trả về đúng chừng
 * ấy. Việc tra dữ liệu thật vẫn nằm ở tầng dưới và vẫn lọc theo doctorId từ JWT, nên không
 * có gì rò rỉ. Thêm doctorId vào khóa chỉ làm cache nguội đi mà không mua thêm an toàn.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class IntentClassifier {

    /** Đủ cho một phòng khám hỏi cả ngày; vượt thì dọn các ngày cũ (xem purge). */
    private static final int MAX_CACHE_ENTRIES = 500;

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

    private final GeminiClient gemini;
    private final ObjectMapper objectMapper;

    /** Kết quả phân loại. `cached` chỉ để ghi log, không lộ ra API. */
    public record Classification(String intent, LocalDate from, LocalDate to, String name,
                                 boolean cached) {}

    private final Map<String, Classification> cache = new ConcurrentHashMap<>();

    /**
     * @param context ngữ cảnh các lượt trước, RỖNG nghĩa là câu hỏi đứng độc lập → được cache.
     */
    public Classification classify(String question, String context, LocalDate today) {
        var cacheable = context.isEmpty();
        var key = cacheable ? cacheKey(question, today) : null;
        if (cacheable) {
            var hit = cache.get(key);
            if (hit != null) {
                log.info("Intent cache HIT — bỏ qua Gemini");
                return new Classification(hit.intent(), hit.from(), hit.to(), hit.name(), true);
            }
        }

        var result = askModel(question, context, today);
        // Chỉ cache kết quả DÙNG ĐƯỢC. Cache cả UNKNOWN thì một lần model trả lỗi sẽ đóng
        // đinh câu hỏi đó thành "không hiểu" cho tới hết ngày, dù hỏi lại vẫn ra đúng.
        if (cacheable && !"UNKNOWN".equals(result.intent())) {
            purgeIfLarge(today);
            cache.put(key, result);
        }
        return result;
    }

    private Classification askModel(String question, String context, LocalDate today) {
        try {
            var raw = gemini.generate(CLASSIFY_PROMPT.formatted(today),
                context + "Câu hỏi hiện tại: " + question);
            var json = objectMapper.readTree(raw);
            // Parse HẾT vào biến tạm rồi mới dựng kết quả. Nếu gán intent trước rồi mới parse
            // from/to, model trả "from":"null" là ném lỗi giữa chừng: intent vẫn giữ nhưng
            // khoảng ngày âm thầm rơi về hôm nay — hỏi "tháng này" lại nhận số của hôm nay.
            var intent = json.path("intent").asText("UNKNOWN");
            var from = parseDate(json, "from", today);
            var to = parseDate(json, "to", today);
            var name = parseText(json, "name");
            return new Classification(intent, from, to, name, false);
        } catch (Exception e) {
            log.warn("Không phân loại được câu hỏi, coi như UNKNOWN", e);
            return new Classification("UNKNOWN", today, today, "", false);
        }
    }

    /**
     * KHÔNG bỏ dấu tiếng Việt khi dựng khóa. Bỏ dấu sẽ gộp "Nguyễn Văn Á" với "Nguyễn Văn A"
     * thành một khóa, và lượt sau nhận lại tên của bệnh nhân TRƯỚC — sai người mà không báo.
     * Chỉ gộp hoa/thường và khoảng trắng thừa; chừng đó đã đủ để các chip gợi ý và câu hỏi
     * gõ lặp cùng trúng một khóa.
     */
    private static String cacheKey(String question, LocalDate today) {
        return question.trim().toLowerCase().replaceAll("\\s+", " ") + "|" + today;
    }

    /** Khóa có gắn ngày nên entry của hôm qua vô dụng — dọn chúng trước khi đụng tới hôm nay. */
    private void purgeIfLarge(LocalDate today) {
        if (cache.size() < MAX_CACHE_ENTRIES) return;
        var suffix = "|" + today;
        cache.keySet().removeIf(k -> !k.endsWith(suffix));
        if (cache.size() >= MAX_CACHE_ENTRIES) cache.clear();
    }

    /** Model đôi khi trả CHUỖI "null" thay vì null JSON — coi cả hai là "không có". */
    private static String parseText(JsonNode json, String field) {
        if (!json.hasNonNull(field)) return "";
        var v = json.get(field).asText("").trim();
        return "null".equalsIgnoreCase(v) ? "" : v;
    }

    /** Ngày: thiếu/null/"null" → mặc định; sai định dạng → ném để cả cụm thành UNKNOWN. */
    private static LocalDate parseDate(JsonNode json, String field, LocalDate fallback) {
        var v = parseText(json, field);
        return v.isEmpty() ? fallback : LocalDate.parse(v);
    }
}
