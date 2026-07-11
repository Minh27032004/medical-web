# Nhật ký quyết định (ADR)

Mỗi quyết định ghi: bối cảnh → quyết định → lý do. Muốn làm khác đi phải bàn với chủ dự án trước, không tự ý.

## D13 — PIVOT: hệ nội bộ multi-doctor, bỏ toàn bộ phần bệnh nhân (2026-07-11) ⭐

Chủ dự án cung cấp đặc tả mới (`dac-ta-he-thong-phong-kham_1.md`): web nội bộ cho NHIỀU bác sĩ,
mỗi bác sĩ dữ liệu độc lập (doctor_id), có Admin quản lý tài khoản. **Gỡ bỏ**: cửa hàng thuốc
công khai, giỏ hàng, đặt lịch của bệnh nhân, chat công khai/RAG, thông báo chuông, doanh thu,
Supabase Storage ảnh. Public chỉ còn login. **Các ADR bị vô hiệu**: D2 (customer/patient),
D3 (không tồn kho — giờ CÓ quản lý tồn + quy đổi đơn vị), D4 (QR), D7 phần RAG (chat mới =
intent → query template, không vector).

## D14 — Giữ stack Spring Boot + Supabase (2026-07-11)

Đặc tả *đề xuất* Next.js full-stack + Prisma + NextAuth (cho team làm mới từ đầu). Quyết định:
**giữ nguyên** Spring Boot API + Next.js FE + Supabase Postgres + Cloud Run + CI/CD đã chạy —
mọi yêu cầu chức năng map được 1:1, viết lại chỉ tốn công không thêm giá trị. Chủ dự án yêu cầu
"fix code" chứ không phải rewrite.

## D15 — Đăng nhập bằng username, map sang email ảo Supabase (2026-07-11)

Đặc tả yêu cầu username + password, admin cấp tài khoản, có `is_blocked`. Giữ Supabase Auth làm
identity: username `teo` ⇔ email ảo `teo@clinic.local` (FE map khi login, backend tạo user qua
Admin API với email_confirm=true). `is_blocked` nằm ở bảng users (profiles cũ) — check trong
JWT converter mỗi request, bị khóa → 403 ngay cả khi token còn hạn.

## D16 — Tồn kho theo đơn vị nhỏ nhất (2026-07-11)

`stock_base_qty` luôn lưu theo base_unit; nhập/chỉnh/trừ đều quy về base qua `factor_to_base`;
hiển thị quy ngược lớn→nhỏ. Trừ kho khi lưu đơn nằm CÙNG transaction với tạo đơn. **Cho phép
tồn âm** (kèm cảnh báo đỏ): sổ sách lệch thực tế không được phép chặn việc kê đơn cho bệnh nhân —
bác sĩ đối soát và chỉnh tay sau. Đây là hệ hỗ trợ, thuốc thật nằm trong tủ của bác sĩ.

## D1 — Một phòng khám duy nhất (2026-07-10)
Ban đầu định làm đa phòng khám (multi-tenant), sau đổi thành **1 phòng khám**. Không thiết kế bảng `clinics`, không tenant_id.

## D2 — Một loại tài khoản, Customer là khách vãng lai (2026-07-10)
Customer **không có tài khoản** — chỉ xem + giỏ hàng localStorage + chat LLM. Đăng nhập = Patient. Tránh 2 loại tài khoản phải gộp về sau.

## D3 — Không quản lý số lượng tồn kho (2026-07-10)
Chỉ có cờ `in_stock` bật/tắt. Lý do: đơn giản hóa vận hành. Đánh đổi đã được chủ dự án chấp nhận: không cảnh báo hết hàng tự động.

## D4 — Thanh toán QR hoãn lại (2026-07-10)
Giai đoạn đầu chỉ trả tại quầy. QR + webhook (SePay/Casso/PayOS) vào backlog.

## D5 — Supabase Auth thay vì tự viết auth (2026-07-10)
Supabase Auth phát JWT; Spring Boot làm **resource server**, verify chữ ký qua JWKS endpoint của Supabase, đọc role từ claim. Lý do: sản phẩm thật — không tự viết phần reset password/hash/refresh token dễ sai nhất.

## D6 — Monorepo (2026-07-10)
1 repo GitHub private: `frontend/` (Next.js) + `backend/` (Spring Boot). Solo dev → dễ đồng bộ, 1 PR chạm cả 2 phía.

## D7 — Gemini cho chat (2026-07-10, cập nhật 2026-07-11)
Dùng cho cả intent classification lẫn sinh câu trả lời RAG. Embedding + vector search dùng **pgvector ngay trên Supabase** — không thêm vector DB riêng.
**Cập nhật khi triển khai:** `gemini-2.5-flash` bị Google khóa với API key tạo mới từ 2026 → dùng alias **`gemini-flash-latest`**; embedding `text-embedding-004` không còn → **`gemini-embedding-001` với `outputDimensionality: 768`** (khớp cột vector(768)). Cả hai cấu hình qua env `GEMINI_MODEL` / `GEMINI_EMBEDDING_MODEL`.

## D8 — Deploy: Vercel (FE) + Render (BE) (2026-07-10)
Hệ quả: CORS phải cấu hình tường minh cho domain Vercel; backend không được stateful (Render restart tự do); mọi secret nằm ở env của từng platform.

## D9 — Giỏ hàng Customer ở localStorage, backend stateless (2026-07-10)
Không dùng server session (cookie cross-domain Vercel↔Render vướng SameSite/CORS). Đăng nhập thì merge giỏ localStorage vào DB.

## D10 — JDBC qua Supavisor session mode port 5432 (2026-07-10)
Không dùng transaction mode 6543 (xung đột prepared statements với Hibernate). HikariCP pool 5–10.

## D11 — Snapshot giá trong đơn thuốc/đơn hàng (2026-07-10)
Dòng đơn lưu giá gốc + giá bán tại thời điểm tạo. Doctor đổi giá thuốc không được làm sai doanh thu quá khứ.

## D12 — Soft delete cho dữ liệu y tế (2026-07-10)
Bệnh nhân, đơn thuốc, đơn hàng, thuốc: không xóa cứng. Sản phẩm thật + dữ liệu nhạy cảm → giữ vết.
