-- V8: email (Gmail) cho đăng nhập Google.
-- Tài khoản có Gmail → email auth Supabase = Gmail (đăng nhập Google hoặc Gmail+mật khẩu).
-- Tài khoản chỉ username/password → giữ email ảo <username>@clinic.local như cũ.
-- Whitelist: chỉ Gmail đã được admin cấp mới có row trong users → mới đăng nhập được.
alter table users add column email text;

-- Không trùng Gmail (bỏ qua row không có email). So khớp không phân biệt hoa/thường.
create unique index uq_users_email on users (lower(email)) where email is not null;
