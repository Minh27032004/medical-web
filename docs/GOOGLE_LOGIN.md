# Đăng nhập Google + JWT 3 ngày — thiết lập bắt buộc trên Supabase / Google Cloud

Code đã sẵn sàng (V8 migration + backend + frontend). Phần dưới đây **bạn phải làm trên dashboard**
(Claude không thao tác được), nếu thiếu thì đăng nhập Google sẽ không chạy.

## Mô hình tài khoản (đã code)

- `users.email` = **Gmail** của bác sĩ. Có Gmail → email auth Supabase = chính Gmail đó.
- Admin tạo tài khoản (trang **Quản lý bác sĩ**):
  - Nhập **Gmail** → bác sĩ đăng nhập bằng Google (và bằng Gmail + mật khẩu nếu có đặt mật khẩu).
  - Để trống Gmail nhưng nhập **username + mật khẩu** → tài khoản chỉ đăng nhập bằng username (email ảo `@clinic.local` như cũ).
  - Có thể nhập cả Gmail + username + mật khẩu → đăng nhập được cả 2 cách.
- **Whitelist**: chỉ Gmail đã được admin cấp mới có row trong `users`. Google đăng nhập bằng Gmail
  lạ → backend không thấy tài khoản → frontend hiện *"Bạn chưa có quyền đăng nhập"*.

> Cơ chế liên kết: khi admin nhập Gmail, backend **tạo sẵn 1 auth user Supabase với email = Gmail đó**
> (đã xác nhận email). Khi bác sĩ đăng nhập Google cùng Gmail, Supabase **tự liên kết** danh tính Google
> vào auth user đó (auto-link theo email đã xác thực) → `JWT sub` = đúng id đã tạo → `doctor_id` không đổi.

## 1. Google Cloud — tạo OAuth Client

1. https://console.cloud.google.com → **APIs & Services → Credentials → Create OAuth client ID**.
2. Application type: **Web application**.
3. **Authorized redirect URIs** thêm URL callback của Supabase:
   `https://<PROJECT_REF>.supabase.co/auth/v1/callback`
   (PROJECT_REF là phần đầu SUPABASE_URL của bạn).
4. Lưu lại **Client ID** và **Client secret**.

## 2. Supabase — bật Google provider

Dashboard → **Authentication → Providers → Google**:
- Bật **Enable Sign in with Google**.
- Dán **Client ID** + **Client secret** ở bước 1 → Save.

## 3. Supabase — Redirect URLs

**Authentication → URL Configuration**:
- **Site URL**: `http://localhost:3000` (dev) — production đổi thành domain Vercel.
- **Redirect URLs** (thêm cả hai): `http://localhost:3000/login` và `https://<domain-vercel>/login`.

## 4. Supabase — auto-link theo email (QUAN TRỌNG)

Auto-link danh tính cùng email đã xác thực là **mặc định bật**. Nếu tài khoản Supabase của bạn
đã tắt, hãy bật lại — nếu tắt, đăng nhập Google với Gmail đã cấp sẽ **báo trùng email** và không vào được.

## 5. JWT hết hạn sau 3 ngày

**Authentication → Sessions / Tokens** (tùy phiên bản dashboard):
- **Access token (JWT) expiry** = `259200` giây (3 ngày).
- (Tùy chọn) Refresh/session timebox để phiên kéo dài tương ứng.

Backend chỉ đọc `exp` trong token nên không cần đổi code — chỉ cần chỉnh ở đây.

## Kiểm thử

1. Admin → Quản lý bác sĩ → tạo bác sĩ với **Gmail của bạn** (để trống username/mật khẩu).
2. Đăng xuất → trang login bấm **Đăng nhập bằng Google** → chọn đúng Gmail đó → vào được.
3. Thử Gmail KHÁC (chưa cấp) → phải thấy *"Bạn chưa có quyền đăng nhập"*.
