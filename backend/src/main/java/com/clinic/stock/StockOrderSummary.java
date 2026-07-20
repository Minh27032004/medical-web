package com.clinic.stock;

import java.time.Instant;
import java.util.UUID;

/**
 * Dòng tóm tắt cho DANH SÁCH đơn nhập kho — không kèm dòng thuốc.
 *
 * Danh sách chỉ hiện mã đơn + ngày + trạng thái, nên nạp cả items là lãng phí: mỗi đơn tốn
 * thêm 1 query lấy items, rồi MỖI dòng thuốc thêm 1 query nữa để lấy tồn/ảnh. 20 đơn ×
 * 5 thuốc = ~120 query cho một lần mở trang, mà DB lại ở khác vùng với backend.
 * Chi tiết chỉ nạp khi bác sĩ bấm mở đơn.
 */
public record StockOrderSummary(
    UUID id,
    String code,
    String status,
    String source,
    String note,
    Instant createdAt,
    Instant receivedAt,
    Instant cancelledAt,
    /** Đếm bằng subquery, không nạp collection. */
    int itemCount
) {}
