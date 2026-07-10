# Đặc tả chức năng (đã chốt với chủ dự án — 2026-07-10)

Nguồn sự thật về nghiệp vụ. Mọi thay đổi phạm vi phải cập nhật file này.

## 1. Vai trò & quyền

| Hành động | Customer (vãng lai) | Patient (đăng nhập) | Doctor |
|---|---|---|---|
| Xem cửa hàng thuốc | ✅ | ✅ | ✅ |
| Thêm giỏ hàng | ✅ (localStorage) | ✅ (DB) | — |
| Mua thuốc / đặt lịch | ❌ → yêu cầu đăng nhập | ✅ | — |
| Chat tư vấn tầng LLM | ✅ (chỉ thông tin chung) | ✅ (+ ngữ cảnh cá nhân: lịch sử mua hàng, lịch sử khám) | — |
| Chat với bác sĩ (tầng 2) | ❌ | ✅ | ✅ (trả lời) |
| Quản lý kho thuốc, đơn thuốc, doanh thu | — | — | ✅ |

Đăng ký/đăng nhập qua **Supabase Auth**. Customer → Patient chỉ bằng cách đăng nhập; không có 2 loại tài khoản riêng.

## 2. Cửa hàng thuốc

- Doctor thêm/sửa thuốc: **tên, ảnh chụp, giá gốc, giá bán, hạn sử dụng (HSD)**.
- **Không quản lý số lượng tồn kho** — chỉ có cờ `in_stock` để Doctor bật/tắt "còn hàng/hết hàng". Thuốc hết hàng hoặc hết HSD tự ẩn khỏi cửa hàng (không xóa — giữ lịch sử giá cho đơn cũ).
- Patient/Customer xem danh sách, tìm kiếm; chỉ Patient mua được.

## 3. Đặt hàng & thanh toán

- **Nhận thuốc tại phòng khám — KHÔNG ship.**
- Trạng thái đơn: `PENDING → CONFIRMED → READY → COMPLETED / CANCELLED`.
- Sinh **mã nhận hàng** cho Patient đưa Doctor đối chiếu khi đến lấy.
- Thanh toán giai đoạn đầu: **trả tại quầy**. Thanh toán QR ngân hàng: **để sau** (đã quyết định hoãn).

## 4. Đặt lịch khám

- Patient chọn khung giờ trống (Doctor khai báo lịch làm việc; giờ đã đặt bị khóa — chống trùng).
- Patient có thể **upload ảnh giấy khám sức khỏe** để Doctor xem trước buổi khám.
- Có hủy/đổi lịch. Trạng thái: `BOOKED → CONFIRMED → DONE / CANCELLED`.

## 5. Khám bệnh & đơn thuốc (phía Doctor)

- Bệnh nhân mới: Doctor tạo hồ sơ — **ảnh, tên, SĐT, tuổi** (các trường có thể bỏ trống).
- Sau khám, Doctor tạo **đơn thuốc** gồm:
  - Triệu chứng bệnh
  - Ảnh bệnh (X-quang, điện tim, ...) — nhiều ảnh
  - Chẩn đoán
  - Danh sách thuốc: mỗi dòng có nút **(+)** thêm dòng mới; ô tên thuốc có **autocomplete trực quan (ảnh + tên)** lấy từ kho thuốc của Doctor
- Đơn thuốc lưu **snapshot giá** (giá gốc + giá bán tại thời điểm kê).

## 6. Chat tư vấn 2 tầng

- **Tầng 1 — LLM (Gemini 2.5 Flash)**: phân loại intent → RAG trên các chunk thông tin phòng khám, bác sĩ, dịch vụ, thuốc (pgvector trên Supabase). Patient có thêm intent cá nhân ("lịch sử mua hàng của tôi", "lịch sử khám của tôi").
- **Tầng 2 — Doctor**: khi intent vượt phạm vi (triệu chứng, chẩn đoán, kê đơn) hoặc người dùng yêu cầu → chuyển sang chat với bác sĩ.
- **Guardrail bắt buộc**: LLM không chẩn đoán, không kê đơn; từ khóa nguy hiểm (đau ngực, khó thở...) → chuyển bác sĩ ngay + disclaimer.

## 7. Doanh thu & lịch sử (phía Doctor)

- Xem doanh thu theo **ngày / tuần / tháng**; hiển thị cả **lãi gộp** (giá bán − giá gốc) và tách nguồn thu (tiền khám vs tiền thuốc).
- Lịch sử khám: list đơn thuốc theo ngày, kèm giá gốc và **tổng doanh thu từng ngày** hiển thị kế bên.

## 8. Backlog (chưa làm — đã ghi nhận)

- Thanh toán QR ngân hàng (webhook SePay/Casso/PayOS)
- Nhắc lịch hẹn / nhắc tái khám (Zalo/SMS/email)
- Cờ thuốc kê đơn (Rx) vs OTC — chặn Customer mua thuốc kê đơn tự do
- Xuất đơn thuốc PDF / in
- Ghi chú riêng tư của Doctor về bệnh nhân
- Thống kê thuốc bán chạy, biểu đồ doanh thu
- Cảnh báo thuốc sắp hết HSD trên dashboard Doctor
