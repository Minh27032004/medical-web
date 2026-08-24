package com.clinic.chat;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;

/**
 * Quy TỪ KHÓA thời gian ra khoảng ngày cụ thể — tính ở BACKEND, theo đồng hồ máy chủ và
 * múi giờ phòng khám.
 *
 * Vì sao không để LLM tự quy đổi (cách làm cũ): prompt chỉ đưa cho model một chuỗi ngày rồi
 * bắt nó tự tính "tuần này", "tháng trước" ra YYYY-MM-DD. Model phải tự biết hôm nay là thứ
 * mấy, tự biết tháng trước có bao nhiêu ngày — và nó sai lặng lẽ: trả về một khoảng ngày
 * trông rất hợp lệ nên không có chỗ nào báo lỗi, bác sĩ chỉ thấy con số không khớp trí nhớ.
 * Số học lịch là việc của máy, không phải của mô hình ngôn ngữ.
 *
 * Nay model chỉ phải làm đúng phần nó giỏi: đọc "tháng này" và chọn ra nhãn THIS_MONTH.
 * Ngày tháng do đây tính. Cùng bộ từ khóa này dùng cho cả chip gợi ý ở frontend.
 *
 * CUSTOM = câu hỏi nêu ngày cụ thể ("từ 1/8 đến 15/8") — lúc đó mới dùng from/to của model.
 */
public final class ChatRange {

    private ChatRange() {}

    /** Danh sách đưa vào prompt — sửa ở đây thì sửa cả chuỗi trong IntentClassifier. */
    public static final String KEYWORDS =
        "TODAY, YESTERDAY, THIS_WEEK, LAST_WEEK, THIS_MONTH, LAST_MONTH, THIS_YEAR, "
        + "LAST_7_DAYS, LAST_30_DAYS, ALL_TIME, CUSTOM";

    /**
     * Ngày bắt đầu khi hỏi "từ trước tới nay". Không dùng LocalDate.MIN: Postgres nhận
     * timestamp năm -999999999 nhưng index thì vô dụng, mà phòng khám cũng không có dữ liệu
     * trước khi phần mềm chạy. 2020 là mốc an toàn thừa sức bao trọn dữ liệu thật.
     */
    private static final LocalDate EPOCH = LocalDate.of(2020, 1, 1);

    /**
     * @param range từ khóa model trả về (có thể null/lạ → coi như CUSTOM)
     * @param from  chỉ dùng khi range = CUSTOM; null thì lùi về mặc định của intent
     * @param to    như trên
     * @param today hôm nay theo giờ phòng khám
     */
    public static LocalDate[] resolve(String range, LocalDate from, LocalDate to, LocalDate today) {
        var key = range == null ? "" : range.trim().toUpperCase();
        return switch (key) {
            case "TODAY" -> span(today, today);
            case "YESTERDAY" -> span(today.minusDays(1), today.minusDays(1));

            // Tuần bắt đầu từ THỨ HAI — quy ước lịch Việt Nam, khác mặc định Chủ nhật của
            // locale Mỹ. Bác sĩ hỏi "tuần này" lúc sáng thứ hai là muốn tính từ hôm nay.
            case "THIS_WEEK" -> span(today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)), today);
            case "LAST_WEEK" -> {
                var monday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).minusWeeks(1);
                yield span(monday, monday.plusDays(6));
            }

            // "Tháng này" kết thúc ở HÔM NAY chứ không phải cuối tháng: hỏi ngày 10 mà trả
            // khoảng tới ngày 31 thì nửa sau là tương lai — vô nghĩa, và làm câu "trung bình
            // mỗi ngày" tính sai.
            case "THIS_MONTH" -> span(today.withDayOfMonth(1), today);
            case "LAST_MONTH" -> {
                var first = today.minusMonths(1).withDayOfMonth(1);
                yield span(first, first.with(TemporalAdjusters.lastDayOfMonth()));
            }
            case "THIS_YEAR" -> span(today.withDayOfYear(1), today);

            // "7 ngày qua" gồm CẢ hôm nay → lùi 6 ngày, không phải 7.
            case "LAST_7_DAYS" -> span(today.minusDays(6), today);
            case "LAST_30_DAYS" -> span(today.minusDays(29), today);

            case "ALL_TIME" -> span(EPOCH, today);
            default -> span(from, to); // CUSTOM hoặc từ khóa lạ
        };
    }

    private static LocalDate[] span(LocalDate from, LocalDate to) {
        return new LocalDate[] {from, to};
    }
}
