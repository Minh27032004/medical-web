package com.clinic.common;

import org.springframework.data.domain.PageRequest;

/**
 * Dựng PageRequest từ tham số của người dùng một cách AN TOÀN.
 *
 * page/size đến thẳng từ query string nên phải coi là dữ liệu không tin được.
 * PageRequest.of ném IllegalArgumentException khi page âm hoặc size &lt;= 0, và ngoại lệ đó
 * rơi ra thành lỗi 500 — bác sĩ chỉ thấy màn hình hỏng, không biết vì sao. Kẹp về khoảng
 * hợp lệ thì một URL gõ nhầm chỉ dẫn về trang đầu chứ không làm sập màn hình.
 *
 * maxSize để từng nơi tự quyết vì trần không giống nhau: danh sách bệnh nhân 100 là thừa
 * đủ, còn trang kho cố ý tải 500 dòng để lọc và phân trang phía client.
 */
public final class Pageables {

    private Pageables() {}

    public static PageRequest of(int page, int size, int maxSize) {
        return PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), maxSize));
    }
}
