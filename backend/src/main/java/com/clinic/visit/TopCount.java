package com.clinic.visit;

/**
 * Một dòng thống kê "nhãn — số lần" cho trợ lý chat (bệnh nhân khám nhiều nhất, chẩn đoán
 * hay gặp nhất, thuốc kê nhiều nhất).
 *
 * Dùng chung MỘT record cho cả ba loại thay vì ba record gần giống nhau: phía chat chỉ cần
 * đúng hai thứ — hiện chữ gì và đếm được bao nhiêu. Chẩn đoán cần cả mã lẫn tên thì ghép
 * ngay trong câu truy vấn (concat) chứ không đẻ thêm kiểu.
 *
 * `total` để Long (không phải long): count() của JPQL trả về Long, ép nguyên thủy trong
 * constructor expression là chỗ Hibernate hay vấp.
 */
public record TopCount(String label, Long total) {}
