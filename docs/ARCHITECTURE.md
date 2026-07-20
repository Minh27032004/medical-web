# Kiến trúc hệ thống (từ pivot 2026-07-11 — multi-doctor nội bộ)

## Sơ đồ tổng quan

```
[Browser — chỉ bác sĩ & admin]
   │
   ├── Next.js (Vercel) — login + app quản lý; KHÔNG còn trang public nào khác
   │        │  REST HTTPS + JWT Bearer
   │        ▼
   └── Spring Boot API (Render, Singapore) — mọi business logic
            │      MỌI QUERY DỮ LIỆU BÁC SĨ ĐỀU LỌC doctor_id TỪ JWT (tầng service)
            ├── PostgreSQL (Supabase, pooler session 5432)
            ├── Supabase Auth — identity (username ⇔ email ảo @clinic.local, xem D15)
            └── Gemini (gemini-3-flash-preview) — CHỈ classify intent + trích tham số cho chat
                (không RAG, không sinh SQL tự do)
```

- Prod: FE https://medical-web-lime.vercel.app · BE https://clinic-backend-9e93.onrender.com
- CI/CD: push main → Vercel (FE) + Render tự build Docker (backend/**), xem docs/DEPLOY.md

## ERD (V4)

```
users (= bảng profiles cũ, 1-1 auth.users)     icd10_codes (dùng chung, seed sẵn)
├─ id uuid PK = auth.users.id                  ├─ code text PK  (vd J00)
├─ role: admin | doctor                        └─ name text     (tên tiếng Việt)
├─ username text UNIQUE (đăng nhập)
├─ full_name, phone, clinic_name (in trên đơn)
├─ is_blocked bool default false  ← check MỖI request
└─ created_at

patients                                visits (lần khám)
├─ id uuid PK                           ├─ id uuid PK
├─ doctor_id ──→ users                  ├─ doctor_id, patient_id
├─ full_name, phone, gender, address   ├─ visit_date timestamptz default now
├─ has_drug_allergy + drug_allergy_note├─ diagnosis_code + diagnosis_name (snapshot, BẮT BUỘC)
├─ has_chronic_condition + note        ├─ note
└─ created_at                           ├─ deleted_at NULL (xóa mềm — V12)
                                        └─ created_at
   idx (doctor_id, full_name) partial deleted_at null   idx (doctor_id, visit_date desc)
                                           partial deleted_at null — V12

prescriptions (1:1 visit)               prescription_items (snapshot)
├─ id, doctor_id, visit_id UNIQUE       ├─ prescription_id, medicine_id NULL
└─ created_at, printed_at NULL          ├─ medicine_name, base_unit (snapshot)
                                        ├─ dose_morning/noon/afternoon/evening numeric
                                        ├─ special_dose_text, usage_note, num_days
                                        ├─ total_quantity_base numeric
                                        ├─ is_injection bool
                                        └─ is_infusion bool (V11)
                                           idx (prescription_id) — V10

medicines (kho — MỖI bác sĩ riêng)      medicine_units (quy đổi)
├─ id, doctor_id, name                  ├─ medicine_id
├─ is_injection (→ chỉ đơn vị ống)      ├─ unit_name: chai|hop|vi|vien|goi|ong
├─ is_infusion (→ chỉ đơn vị chai, V11) │
├─ base_unit text                       ├─ level_order int (lớn→nhỏ)
├─ stock_base_qty numeric (CÓ THỂ ÂM)   └─ factor_to_base numeric
└─ low_stock_threshold int default 30
   idx (doctor_id, name) partial deleted_at null

medicine_templates (thuốc mẫu)
├─ id, doctor_id, medicine_id NULL, name
├─ default_dose_* ×4, default_usage_note, default_num_days
```

## API contract (prefix /api, JWT bắt buộc trừ login phía Supabase)

| Nhóm | Endpoint | Quyền |
|---|---|---|
| Auth | `POST /auth/resolve-login` {loginId} → {email} (username → email auth; Gmail nếu có, else ảo) | public |
| Admin | `GET/POST /admin/doctors`, `PATCH /admin/doctors/{id}/block` `/unblock` | ROLE_ADMIN |
| Me | `GET /me/profile` | đăng nhập |
| Patients | CRUD `/doctor/patients` + `?q=` (tên/SĐT) + `GET /{id}/visits` | ROLE_DOCTOR |
| ICD-10 | `GET /doctor/icd10?q=` (2 chiều code/name, limit 20) | ROLE_DOCTOR |
| Medicines | CRUD `/doctor/medicines` (+units), `GET ?q=`, `POST /{id}/adjust-stock` {entries:[{unitName,qty}], reason}, `GET /low-stock`, `GET /suggest?q=` (ưu tiên template) | ROLE_DOCTOR |
| Templates | CRUD `/doctor/templates` | ROLE_DOCTOR |
| Stock orders | `GET /doctor/stock-orders` (CHỈ tóm tắt: mã, ngày, trạng thái, số dòng — 1 query), `POST /doctor/stock-orders`, `GET /{id}`, `GET /quick-suggestions` (thuốc sắp hết, mặc định 1 đơn vị lớn nhất), `POST /{id}/receive` (cộng tồn, chỉ khi PENDING), `DELETE /{id}` (hủy), `GET /{id}/export` → .xlsx (V14) | ROLE_DOCTOR |
| Visits + Rx | `POST /doctor/visits` {patientId, diagnosisCode/Name, note, items[]} → tạo visit + prescription + trừ kho 1 transaction; `GET /doctor/visits?date=&from=&to=`; `GET /doctor/visits/{id}` (kèm đơn); `GET /doctor/patients/{id}/last-prescription` (copy đơn); `POST /doctor/prescriptions/{id}/printed`; `DELETE /doctor/visits/{id}?restoreStock=` (xóa mềm V12, tùy chọn hoàn thuốc về kho) | ROLE_DOCTOR |
| Chat | `POST /doctor/chat` {question} → intent+params (Gemini) → query template → kết quả cấu trúc | ROLE_DOCTOR |

Cô lập: mọi service method nhận `doctorId` (từ JWT sub) và mọi repository query có điều kiện doctor_id.
Admin không có endpoint nào đọc dữ liệu lâm sàng.

## Chat nội bộ — intent & template (không RAG)

Intent seed (mở rộng dần): `PATIENTS_BY_DATE` (khoảng ngày), `VISITS_BY_DATE`,
`INJECTION_PRESCRIPTIONS_BY_DATE`, `PATIENT_HISTORY` (tên bệnh nhân), `LOW_STOCK`,
`MEDICINE_STOCK` (tên thuốc). Gemini trả JSON {intent, params}; backend validate whitelist
intent + parse params → chạy JPQL/SQL dựng sẵn có `:doctorId`. LLM không bao giờ chạm DB.

## In đơn thuốc

Trang `/print/prescriptions/{id}` phía Next.js: render đơn (tên phòng khám = users.clinic_name,
tên bác sĩ, bệnh nhân, chẩn đoán, bảng thuốc liều 4 buổi + cách dùng + số ngày) với CSS
`@media print`; nút In gọi `window.print()` và POST /printed để lưu printed_at.

## Trạng thái triển khai — HOÀN THÀNH (2026-07-12)

- [x] Docs cập nhật theo đặc tả mới
- [x] V4 migration (drop bảng cũ + schema mới) + seed 84 mã ICD-10 + V5 unaccent
- [x] Backend: auth admin/doctor + is_blocked (hiệu lực tức thì), admin quản lý bác sĩ
- [x] Backend: patients, medicines+units (quy đổi), icd10 (2 chiều + không dấu),
      visits+prescriptions (trừ kho trong transaction, copy đơn), templates, history, chat template
- [x] Frontend: login-only + app doctor/admin + trang in @media print
- [x] Test cô lập doctor_id (chéo 404, kho 0/0) + quy đổi kho (3 hộp→150→kê 15→"2 hộp 3 vĩ 5 viên")
- [x] Đã push, CI deploy (Cloud Run + Vercel)

**Reset DB 2026-07-19 (V10):** xóa toàn bộ dữ liệu test + tài khoản doctor; DB prod chỉ còn
admin/0907729127 (ADMIN) + 86 mã ICD-10. V10 đồng thời: bật RLS chat_messages, thêm idx
prescription_items(prescription_id), bỏ idx chết (icd10 tsvector, patients phone), chuyển
idx patients/medicines/templates sang partial `deleted_at is null`, gỡ extension vector.
