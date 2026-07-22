package com.clinic.common;

import java.beans.PropertyEditorSupport;
import org.springframework.web.bind.WebDataBinder;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.InitBinder;

/**
 * Bỏ ký tự NUL (U+0000) khỏi mọi tham số chuỗi đi vào controller.
 *
 * VÌ SAO: Postgres KHÔNG lưu được byte 0x00 trong kiểu text — driver ném
 * `PSQLException: invalid byte sequence for encoding "UTF8": 0x00`. Trước bản vá này, chỉ
 * cần gửi `?q=abc%00def` là mọi endpoint tìm kiếm (`/patients`, `/medicines`, `/icd10`)
 * trả HTTP 500 kèm stack trace trong log. Không rò dữ liệu, nhưng là đường làm hỏng
 * request bằng một ký tự — và log bẩn thì che mất lỗi thật.
 *
 * VÌ SAO LỌC THAY VÌ TRẢ 400: NUL không mang nghĩa gì trong tên bệnh nhân hay tên thuốc;
 * nó chỉ xuất hiện do dữ liệu hỏng hoặc do người ta cố tình thử. Lọc đi cho request chạy
 * tiếp đúng như bác sĩ mong đợi, thay vì bắt họ đọc một thông báo lỗi vô nghĩa.
 *
 * VÌ SAO CHỈ U+0000: đây là ký tự DUY NHẤT Postgres từ chối. Các ký tự điều khiển khác
 * (tab, xuống dòng…) lưu được bình thường, lọc thêm là tự ý sửa dữ liệu người dùng nhập.
 *
 * PHẠM VI: @InitBinder áp cho @RequestParam / @PathVariable / form binding — tức đúng
 * đường đã tái hiện được lỗi. Thân JSON (@RequestBody) đi qua Jackson nên KHÔNG được bản
 * vá này che; đường đó chưa kiểm chứng có sập hay không.
 */
@ControllerAdvice
public class RequestTextSanitizer {

    /**
     * U+0000 — ký tự DUY NHẤT Postgres không lưu được trong kiểu text.
     *
     * Dựng bằng Character.toString(0) chứ không nhúng ký tự NUL thật vào file .java: nó
     * vô hình, editor dễ nuốt mất khi lưu, và git diff hiển thị file thành binary.
     */
    private static final String NUL = Character.toString(0);

    @InitBinder
    public void stripNulChars(WebDataBinder binder) {
        binder.registerCustomEditor(String.class, new PropertyEditorSupport() {
            @Override
            public void setAsText(String text) {
                setValue(text == null ? null : text.replace(NUL, ""));
            }
        });
    }
}
