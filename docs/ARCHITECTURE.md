# Kiến trúc hệ thống

> ⚠️ Chủ dự án sẽ cung cấp kiến trúc chi tiết và cập nhật file này. Phần dưới là khung sườn + các ràng buộc đã chốt để kiến trúc phải tuân theo.

## Sơ đồ tổng quan

```
[Browser]
   │
   ├── Next.js (Vercel) ── giao diện Customer/Patient/Doctor, giỏ hàng localStorage
   │        │  REST (HTTPS, JWT Bearer)
   │        ▼
   └── Spring Boot API (Render) ── toàn bộ business logic, verify JWT (JWKS)
            │
            ├── PostgreSQL (Supabase, port 5432 session mode) ── dữ liệu + pgvector (RAG chunks)
            ├── Supabase Storage ── ảnh thuốc (public) / ảnh y tế (private + signed URL)
            ├── Supabase Auth ── đăng ký, đăng nhập, phát JWT
            └── Gemini 2.5 Flash API ── intent classification + trả lời RAG
```

## Ràng buộc kiến trúc (từ docs/DECISIONS.md)

- Backend **stateless** — không server session, scale/restart tự do trên Render.
- Frontend **không nói chuyện trực tiếp với Postgres** — mọi truy cập dữ liệu đi qua Spring Boot API. Supabase JS client phía FE chỉ dùng cho Auth (và upload Storage nếu kiến trúc chọn upload trực tiếp bằng signed upload URL).
- RLS trên Supabase: vì API dùng connection chung (không phải per-user), phân quyền thực thi ở **tầng Spring Security**, không dựa vào RLS. Cân nhắc bật RLS "deny all" cho các bảng nhạy cảm để chặn truy cập ngoài API.
- CORS: chỉ allow origin domain Vercel (prod) + localhost (dev).

## Các mục chờ chủ dự án cung cấp

- [ ] Sơ đồ ERD / danh sách bảng
- [ ] Danh sách API endpoints (REST contract)
- [ ] Cấu trúc thư mục chi tiết trong `frontend/` và `backend/`
- [ ] Luồng chat 2 tầng (state machine chuyển LLM → Doctor)
- [ ] Chiến lược môi trường (dev/prod), CI/CD
