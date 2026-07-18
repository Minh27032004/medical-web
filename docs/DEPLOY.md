# Hướng dẫn deploy & CI/CD

Mục tiêu: push code lên GitHub → **backend tự deploy lên Render**, **frontend tự deploy lên Vercel**.

> LỊCH SỬ (2026-07-18): backend từng chạy Cloud Run nhưng billing GCP hết hạn → chuyển sang
> Render. Workflow GitHub Actions deploy Cloud Run đã gỡ. KHÔNG xóa project GCP
> `project-0a96f6c2-d0b9-44ce-b28` — `GEMINI_API_KEY` (AI Studio) gắn với project này.

## Kiến trúc deploy

```
git push main
 ├── thay đổi trong backend/**  → Render tự build Docker → Web Service (Singapore)
 └── mọi thay đổi               → Vercel tự build frontend/ → CDN toàn cầu
```

- Backend URL: https://clinic-backend-9e93.onrender.com
- Frontend URL: https://medical-web-lime.vercel.app
- Database: Supabase Postgres (aws-1-ap-south-1, Supavisor SESSION port 5432 — D10)

## A. Backend trên Render — thiết lập 1 lần (đã làm 2026-07-18)

1. https://render.com → **New → Web Service** → nối repo `Minh27032004/medical-web`
2. Cấu hình:
   - **Name**: `clinic-backend` · **Language**: Docker · **Branch**: `main`
   - **Region**: Singapore (gần VN + Supabase ap-south-1)
   - **Root Directory**: `backend` ← monorepo; chỉ thay đổi trong `backend/` mới trigger deploy
   - **Dockerfile Path**: `./Dockerfile` (mặc định, tương đối theo Root Directory)
   - **Health Check Path**: `/actuator/health`
3. **Environment Variables** — 11 biến, giá trị như `backend/.env`, RIÊNG `FRONTEND_ORIGIN`
   phải là domain Vercel (không phải localhost):
   `DATABASE_URL`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`, `DB_POOL_SIZE`,
   `SUPABASE_URL`, `SUPABASE_JWKS_URI`, `SUPABASE_SERVICE_ROLE_KEY`,
   `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_EMBEDDING_MODEL`,
   `FRONTEND_ORIGIN=https://medical-web-lime.vercel.app`

Cơ chế port: Render bơm env `PORT`, `application.yml` đọc `${PORT:8080}` — không cần chỉnh.

Lưu ý gói **Free**: service ngủ sau 15 phút không hoạt động, request đầu mất ~30–60s đánh thức.
Dùng thật hàng ngày nên cân nhắc gói Starter (chạy liên tục). Nâng cấp không cần cấu hình lại.

## B. Frontend tự deploy (Vercel) — thiết lập 1 lần

1. Vào https://vercel.com → đăng nhập bằng GitHub → **Add New… → Project**
2. **Import** repo `Minh27032004/medical-web`
3. Ở màn cấu hình:
   - **Root Directory** → bấm Edit → chọn **`frontend`** ← quan trọng nhất (monorepo)
   - Framework: Next.js (tự nhận)
4. **Environment Variables** — thêm 3 biến:
   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://cgnwrbbrtqyqmlpyrudx.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (publishable key — xem `frontend/.env.local`) |
   | `NEXT_PUBLIC_API_URL` | `https://clinic-backend-9e93.onrender.com` |
5. **Deploy** → xong sẽ có domain dạng `https://<ten>.vercel.app`

Từ giờ **mọi push lên `main` Vercel tự build + deploy** (mặc định), nhánh khác có Preview URL riêng.

`NEXT_PUBLIC_*` được **nướng vào bundle lúc build** — đổi giá trị xong phải **Redeploy**
(Deployments → ⋯ → Redeploy) mới có tác dụng, không tự áp cho bản đang chạy.

## C. Checklist khi đổi domain/URL bất kỳ bên nào

- Đổi domain Vercel → sửa `FRONTEND_ORIGIN` trên Render (Environment → Save; service tự restart).
  Thiếu bước này frontend bị **CORS 403** khi gọi API.
- Đổi URL backend → sửa `NEXT_PUBLIC_API_URL` trên Vercel + Redeploy.

## Vận hành

- Xem log backend: Render Dashboard → clinic-backend → **Logs** (realtime).
- Deploy tay: Render Dashboard → **Manual Deploy → Deploy latest commit**.
- Kiểm tra nhanh backend sống: `curl https://clinic-backend-9e93.onrender.com/actuator/health`
  → `{"status":"UP"}`.
