# Kiến trúc hệ thống

## Sơ đồ tổng quan

```
[Browser]
   │
   ├── Next.js (Vercel) — UI Customer/Patient/Doctor, giỏ hàng localStorage,
   │        │              Supabase JS chỉ dùng cho Auth (login/register/token)
   │        │  REST HTTPS + JWT Bearer
   │        ▼
   └── Spring Boot API (Render) — toàn bộ business logic, verify JWT qua JWKS
            │
            ├── PostgreSQL (Supabase, JDBC pooler SESSION mode port 5432)
            │      └── pgvector: bảng kb_chunks cho RAG
            ├── Supabase Storage — ảnh thuốc (bucket public: medicine-images)
            │                      ảnh y tế (bucket private: medical-docs, signed URL)
            ├── Supabase Auth — đăng ký/đăng nhập, phát JWT
            └── Gemini 2.5 Flash — intent classification + trả lời RAG
                └── text-embedding-004 (768 chiều) — embedding cho kb_chunks
```

Nguyên tắc: **frontend không bao giờ chạm trực tiếp Postgres**. Supabase JS phía FE chỉ làm Auth. Mọi dữ liệu đi qua Spring Boot. Migration schema bằng **Flyway** (`backend/src/main/resources/db/migration/`) — tự chạy khi backend khởi động.

## ERD

```
profiles (1-1 auth.users)          medicines
├─ id uuid PK = auth.users.id      ├─ id uuid PK
├─ role: PATIENT | DOCTOR          ├─ name, description
├─ full_name, phone, avatar_url    ├─ image_path
└─ timestamps                      ├─ cost_price, sale_price numeric(12,0)
                                   ├─ expiry_date date
patients (hồ sơ do Doctor tạo)     ├─ in_stock bool
├─ id uuid PK                      └─ deleted_at, timestamps
├─ profile_id uuid NULL ──→ profiles   (walk-in không có tài khoản → NULL)
├─ full_name, phone NULL, age NULL, photo_path NULL, note
└─ deleted_at, timestamps

doctor_availability                appointments
├─ weekday 0-6                     ├─ id uuid PK
├─ start_time, end_time            ├─ profile_id ──→ profiles (người đặt)
└─ slot_minutes                    ├─ slot_start, slot_end timestamptz
                                   ├─ status: BOOKED|CONFIRMED|DONE|CANCELLED
appointment_documents              ├─ note
├─ appointment_id ──→ appointments └─ timestamps
└─ image_path (giấy khám SK,           + partial UNIQUE(slot_start)
   bucket private)                       WHERE status IN (BOOKED,CONFIRMED)  ← chống trùng giờ

prescriptions                      prescription_items (SNAPSHOT giá — D11)
├─ id uuid PK                      ├─ prescription_id ──→ prescriptions
├─ patient_id ──→ patients         ├─ medicine_id NULL ──→ medicines
├─ appointment_id NULL             ├─ medicine_name text   ← snapshot tên
├─ symptoms, diagnosis text        ├─ quantity, dosage
├─ exam_fee numeric                ├─ cost_price, sale_price ← snapshot giá
└─ deleted_at, created_at          prescription_images
                                   ├─ prescription_id, image_path
                                   └─ kind: XRAY|ECG|OTHER

cart_items                         orders / order_items
├─ profile_id + medicine_id UNIQUE ├─ orders: profile_id, status, pickup_code(6 ký tự),
└─ quantity                        │    total_amount, payment_method=COUNTER,
                                   │    deleted_at, created_at
                                   │    status: PENDING|CONFIRMED|READY|COMPLETED|CANCELLED
                                   └─ order_items: snapshot name+giá như prescription_items

conversations                      kb_documents / kb_chunks (RAG)
├─ profile_id NULL (ẩn danh)       ├─ kb_documents: title, category(CLINIC|DOCTOR|SERVICE|FAQ), content
├─ anon_key uuid NULL              └─ kb_chunks: document_id, content,
├─ status: AI|WAITING_DOCTOR|             embedding vector(768), HNSW index
│          WITH_DOCTOR|CLOSED
└─ messages: sender USER|AI|DOCTOR, content, created_at
```

Doanh thu = tổng hợp từ `prescriptions.exam_fee` + `prescription_items` (khám trực tiếp) + `order_items` của orders COMPLETED (bán online). Lãi gộp = Σ(sale_price − cost_price) × quantity.

## API contract (REST, prefix `/api`)

| Nhóm | Endpoint chính | Quyền |
|---|---|---|
| Public | `GET /public/medicines`, `GET /public/medicines/{id}`, `GET /public/clinic-info`, `GET /public/appointments/slots?date=` | permitAll |
| Chat | `POST /chat/messages` (anon: kèm `anonKey`; Patient: JWT), `GET /chat/conversations/{id}/messages` | permitAll + JWT |
| Patient | `GET/PUT /me/profile` · `GET/POST/DELETE /me/cart` + `POST /me/cart/merge` · `POST /me/orders` (từ cart) + `GET /me/orders` · `POST /me/appointments` + `POST /me/appointments/{id}/documents` + `DELETE /me/appointments/{id}` · `GET /me/prescriptions` | ROLE_PATIENT |
| Doctor | CRUD `/doctor/medicines` · `GET /doctor/medicines/suggest?q=` (autocomplete ảnh+tên) · `GET/PATCH /doctor/appointments` · CRUD `/doctor/patients` · `POST /doctor/prescriptions` + `GET /doctor/prescriptions?date=` · `PATCH /doctor/orders/{id}/status` · `GET /doctor/chat/inbox` + `POST /doctor/chat/{id}/reply` · `GET /doctor/revenue?period=day|week|month` · CRUD `/doctor/kb` (tài liệu RAG, tự re-embed) | ROLE_DOCTOR |

Quy ước: Patient endpoints lấy identity **từ JWT `sub`**, không bao giờ tin id trong request. Response lỗi thống nhất `{ "code": ..., "message": ... }`. DTO riêng — không expose entity.

## Auth & phân quyền

1. FE đăng ký/đăng nhập bằng `@supabase/supabase-js` → nhận `access_token`.
2. FE gửi `Authorization: Bearer <token>` → Spring (oauth2 resource server) verify chữ ký qua JWKS: `https://<ref>.supabase.co/auth/v1/.well-known/jwks.json`.
3. Role KHÔNG lấy từ JWT claim mà đọc từ bảng `profiles` theo `sub` (cache in-memory) — tránh phải cấu hình Auth Hook, và đổi role có hiệu lực ngay.
4. Đăng ký mới → backend tự tạo `profiles` với role PATIENT ở lần gọi API đầu (upsert). Tài khoản Doctor: seed thủ công bằng SQL (chỉ 1 bác sĩ).

## Luồng chat 2 tầng

```
User gửi message
  → conversation.status == WITH_DOCTOR? → lưu, chờ Doctor trả lời (realtime: polling 5s giai đoạn đầu)
  → ngược lại: Gemini classify intent
       ├─ CLINIC_INFO / DOCTOR_INFO / MEDICINE_INFO / FAQ
       │     → embed câu hỏi → pgvector top-5 kb_chunks → Gemini trả lời với context
       ├─ MY_ORDERS / MY_PRESCRIPTIONS (chỉ Patient — anon thì mời đăng nhập)
       │     → query DB của chính user → Gemini tóm tắt
       ├─ MEDICAL_QUESTION hoặc red-flag keywords (đau ngực, khó thở, chảy máu...)
       │     → KHÔNG trả lời chuyên môn + disclaimer + nút "Gặp bác sĩ"
       │       (red-flag → tự động chuyển WAITING_DOCTOR)
       ├─ MEET_DOCTOR → status = WAITING_DOCTOR, hiện trong inbox Doctor
       └─ SMALLTALK/OTHER → trả lời ngắn, gợi ý chức năng
```

Guardrail cứng (system prompt + code): LLM không chẩn đoán, không kê đơn, không gợi ý liều lượng.

## Cấu trúc thư mục

```
backend/src/main/java/com/clinic/
├── config/          SecurityConfig, CorsConfig, CacheConfig
├── common/          ApiException, GlobalExceptionHandler, ErrorResponse
├── auth/            ProfileEntity, ProfileService (upsert + role lookup), JwtRoleFilter
├── medicine/        entity/repo/service/controller + MedicineSuggestDto
├── cart/            CartItem..., CartController (kèm merge)
├── order/           Order, OrderItem, trạng thái + pickup code
├── appointment/     Appointment, DoctorAvailability, SlotService (tính giờ trống)
├── patient/         PatientEntity... (hồ sơ Doctor tạo)
├── prescription/    Prescription, Items, Images
├── chat/            Conversation, Message, IntentService, RagService, GeminiClient
├── kb/              KbDocument, KbChunk, EmbeddingService (chunking + re-embed)
├── storage/         SupabaseStorageService (signed URL, upload)
└── revenue/         RevenueService (aggregate queries), RevenueController

frontend/src/
├── app/
│   ├── (public)/    page.tsx (trang chủ), medicines/, cart/, chat/
│   ├── (auth)/      login/, register/
│   ├── account/     orders/, appointments/, prescriptions/   ← Patient
│   ├── booking/
│   └── doctor/      dashboard/, medicines/, appointments/, patients/,
│                    prescriptions/, orders/, chat/, revenue/  ← Doctor
├── components/      ui chung (theo feature khi phình to)
├── lib/             supabase.ts (Auth), api.ts (fetch wrapper + Bearer), cart.ts (localStorage)
└── middleware.ts    chặn /doctor/** và /account/** khi chưa đăng nhập
```

## Môi trường & deploy

| Biến | Nơi đặt |
|---|---|
| `DATABASE_URL` (jdbc:postgresql://...pooler.supabase.com:5432/postgres), `DATABASE_USERNAME`, `DATABASE_PASSWORD` | Render |
| `SUPABASE_URL`, `SUPABASE_JWKS_URI`, `SUPABASE_SERVICE_ROLE_KEY` (chỉ backend — KHÔNG bao giờ đưa lên FE) | Render |
| `GEMINI_API_KEY`, `FRONTEND_ORIGIN` | Render |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL` | Vercel |

- CORS: chỉ allow `FRONTEND_ORIGIN` + `http://localhost:3000`.
- RLS: bật deny-all trên các bảng public schema (backend kết nối bằng role `postgres` nên không bị chặn; chặn được truy cập lậu qua anon key).
- Render free tier ngủ sau 15' — chấp nhận giai đoạn đầu, nâng cấp khi dùng thật với bệnh nhân.

## Trạng thái hiện tại

- [x] Scaffold Next.js (`frontend/`) + Spring Boot (`backend/`)
- [x] V1 migration (schema đầy đủ)
- [x] SecurityConfig + CORS + cấu hình env
- [x] Flyway V1 đã chạy trên DB thật; auth end-to-end đã test (login Supabase → JWT ES256 → role DOCTOR từ DB → qua hasRole)
- [x] Seed tài khoản Doctor: `admin@clinic.local` (profiles.role=DOCTOR; trang login sẽ map alias "admin" → email này)
- [ ] Nghiệp vụ từng module (làm theo thứ tự: auth/profile → medicines → cart/order → appointment → patient/prescription → revenue → chat/RAG)
- [ ] Seed dữ liệu kb_documents cho RAG
- [ ] Tạo 2 bucket Storage: `medicine-images` (public), `medical-docs` (private) — làm khi tới module upload
