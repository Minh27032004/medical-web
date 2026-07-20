# Đặc tả chức năng — Hệ thống quản lý phòng khám (Multi-doctor)

> **PIVOT 2026-07-11**: dự án đổi hướng hoàn toàn theo `dac-ta-he-thong-phong-kham_1.md`
> (chủ dự án cung cấp). Web **nội bộ cho bác sĩ** — KHÔNG còn phần dành cho bệnh nhân
> (cửa hàng, đặt lịch, chat công khai đã gỡ bỏ). Public chỉ còn màn hình đăng nhập.

## 1. Tổng quan

- **Nhiều bác sĩ**, mỗi bác sĩ = một "phòng khám" dữ liệu **độc lập hoàn toàn**: bệnh nhân,
  kho thuốc, đơn thuốc, thuốc mẫu riêng. Bác sĩ chỉ thấy dữ liệu của chính mình.
- Luồng chính: tạo bệnh nhân → mở bệnh nhân → tạo lần khám (chẩn đoán ICD-10 **bắt buộc**)
  → tạo đơn thuốc → in đơn. Kho tự trừ khi kê đơn.
- **Không** liên thông Đơn thuốc Quốc gia, **không** ký số (hệ nội bộ). Schema đơn thuốc giữ
  đủ trường để mở rộng sau (Thông tư 26/2025/TT-BYT bắt buộc kê đơn điện tử liên thông nếu
  dùng chính thức).

## 2. Vai trò

| Vai trò | Quyền |
|---|---|
| **Admin** | Tạo tài khoản bác sĩ; khóa/mở khóa (`is_blocked`); xem danh sách bác sĩ. KHÔNG truy cập dữ liệu lâm sàng. |
| **Doctor** | Toàn quyền CRUD trên dữ liệu của CHÍNH MÌNH. |

**Cô lập dữ liệu (yêu cầu bảo mật số 1):** mọi bảng thuộc bác sĩ có `doctor_id`; mọi truy vấn
đọc/ghi lọc theo `doctor_id` lấy từ JWT — thực thi ở tầng API, không chỉ ẩn UI.

## 3. Module

### 3.1 Quản lý tài khoản (Admin)
Tạo bác sĩ (username, mật khẩu tạm, họ tên, tên phòng khám, SĐT); khóa/mở khóa; danh sách.
Tài khoản bị khóa không đăng nhập được (check mỗi request).

### 3.2 Bệnh nhân (Doctor)
- Tạo/sửa: họ tên, SĐT, giới tính, địa chỉ (tùy chọn); **dị ứng thuốc** & **bệnh nền** là
  checkbox → tick mới hiện ô nhập ghi chú. (Phòng khám người lớn — không có trường nhi khoa.)
- **Search nhanh theo tên HOẶC SĐT.**
- Mở bệnh nhân → thông tin + lịch sử các lần khám.

### 3.3 Lần khám & ICD-10
- Chẩn đoán **bắt buộc**, tra ICD-10 **hai chiều**: gõ mã `J00` + space/enter → tự hiện tên;
  gõ một phần tên → gợi ý danh sách mã. Lưu snapshot cả `diagnosis_code` + `diagnosis_name`.
- Bảng `icd10_codes` seed sẵn, dùng chung (không gắn doctor_id).

### 3.4 Đơn thuốc (1:1 với lần khám)
- Dòng thuốc: **autocomplete theo tên** kèm tồn kho (đơn vị nhỏ nhất); gợi ý **ưu tiên thuốc
  mẫu** (tự điền liều mặc định), cũng chọn được thuốc kho trực tiếp.
- Liều: 4 ô **Sáng–Trưa–Chiều–Tối** (số lượng mỗi buổi) + 1 ô **nhập tự do** cho ca đặc biệt.
- Cách dùng (trước/sau ăn...) tùy chọn; **số ngày dùng** để tính tổng.
- Tick **"có tiêm thuốc"** → hiện ô thuốc tiêm (`is_injection`, đơn vị `ống`).
- Tick **"có truyền dịch"** → hiện ô dịch truyền (`is_infusion`, đơn vị `chai`) — V11, cùng
  cơ chế với tiêm: nhập số chai, không dùng số ngày.
- **Tạo lại đơn gần nhất**: copy toàn bộ dòng thuốc từ lần khám gần nhất sang lần mới
  (không ghi đè lịch sử cũ).
- Lưu đơn → **trừ kho** (mục 4.3) trong 1 transaction.
- **In đơn**: tên phòng khám, tên bác sĩ, thông tin bệnh nhân, chẩn đoán, thuốc + liều +
  cách dùng + số ngày.

### 3.5 Kho thuốc (Doctor) — CÓ quản lý tồn kho
- CRUD thuốc + khai báo đơn vị & tỷ lệ quy đổi (mục 4). Search theo tên.
- Chỉnh tay tồn (± theo đơn vị bất kỳ, quy về base; ghi lý do tùy chọn).
- **Cảnh báo sắp hết** khi `stock_base_qty < low_stock_threshold` (mặc định 30).
- Hiển thị tồn quy ngược lên đơn vị lớn (vd 210 viên → "4 hộp 2 vĩ").
- Lọc theo loại (uống/tiêm/truyền dịch) và **lọc "sắp hết"** kèm số đếm.

### 3.5b Đơn nhập kho (Doctor) — V14
Lập đơn đặt thuốc gửi nhà thuốc, tách khỏi việc cộng tồn.
- **Nhập nhanh**: dựng sẵn từ các thuốc đang dưới ngưỡng cảnh báo, mặc định **1 đơn vị lớn
  nhất** mỗi thuốc (1 hộp chứ không phải 1 viên); bác sĩ chỉnh số lượng và đổi đơn vị được.
- **Nhập thủ công**: tự tìm thuốc trong kho rồi thêm dòng, chọn đơn vị theo thuốc đó.
- "Xuất file" → lưu đơn ở trạng thái **chờ xử lý** + tải `.xlsx` (POI, có đầu trang phòng
  khám, bảng STT/tên/đơn vị/số lượng/tồn hiện tại, dòng tổng, ô chữ ký).
- **Tồn kho KHÔNG đổi khi đơn còn chờ.** Nhận đủ hàng → "Xác nhận nhập thuốc" → popup hỏi
  lại → cộng tồn. Đơn rời trạng thái chờ nên bấm hai lần không cộng đôi.
- Quy đổi số lượng đặt về đơn vị nhỏ nhất theo **tỷ lệ tại thời điểm xác nhận**, không phải
  lúc đặt — bác sĩ sửa "1 hộp = 50 → 60 viên" trong lúc chờ hàng thì vẫn ra đúng số thật.

### 3.6 Lịch sử khám
Mặc định 30 ngày gần nhất, filter theo ngày; bấm một lần khám → hiện đơn thuốc hôm đó.

### 3.7 Chat nội bộ (KHÔNG RAG)
- Trả lời câu hỏi truy vấn dữ liệu của chính bác sĩ: "danh sách bệnh nhân hôm nay",
  "các đơn có tiêm thuốc hôm nay"...
- LLM chỉ **phân loại intent + trích tham số** (khoảng ngày, có tiêm, tên bệnh nhân...) →
  map vào **query template dựng sẵn** luôn kèm `doctor_id = current`. KHÔNG cho LLM sinh SQL tự do.

## 4. Logic kho & quy đổi đơn vị (quan trọng nhất)

### 4.1 Khai báo
Thứ tự lớn→nhỏ: **chai > hộp > vĩ > viên > gói**; thuốc tiêm dùng riêng **ống**, truyền dịch
dùng riêng **chai** không quy đổi (tick loại tiêm/truyền thì ẩn đơn vị khác). Bác sĩ tick các đơn vị áp dụng + nhập tỷ lệ giữa 2 cấp liền kề. Đơn vị nhỏ
nhất được tick = `base_unit`; hệ thống tính `factor_to_base` từng đơn vị.
VD Paracetamol: hộp/vĩ/viên, 1 hộp = 5 vĩ, 1 vĩ = 10 viên → base=viên, vĩ=10, hộp=50.

### 4.2 Nhập kho
Quy hết về base rồi cộng `stock_base_qty`. Nhập hỗn hợp được: 3 hộp + 5 vĩ + 10 viên = 210 viên.
Hiển thị tồn: chia lấy dư lớn→nhỏ (210 → 4 hộp 2 vĩ).

### 4.3 Kê đơn → trừ kho
```
liều/ngày = sáng + trưa + chiều + tối
total_quantity_base = liều/ngày × num_days
stock_base_qty -= total_quantity_base   (trong transaction với lưu đơn)
```
Thuốc tiêm: base = ống, không quy đổi, nhập bao nhiêu trừ bấy nhiêu.
Truyền dịch: base = chai, tương tự tiêm — tổng = số chai nhập khi kê đơn.

### 4.4 Snapshot
`prescription_items` lưu snapshot tên thuốc + đơn vị + liều — đơn cũ bất biến khi kho đổi.

## 5. Thứ tự triển khai (theo đặc tả §8)
1. Auth + admin → 2. Bệnh nhân → 3. Kho + quy đổi → 4. ICD-10 → 5. Khám + đơn + mẫu + trừ kho
+ in → 6. Copy đơn gần nhất → 7. Lịch sử → 8. Chat template.
