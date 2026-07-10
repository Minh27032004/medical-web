-- V1: Schema khởi tạo — xem docs/ARCHITECTURE.md (ERD) và docs/DECISIONS.md
-- Chạy trên Supabase Postgres. Backend kết nối bằng role postgres (owner) nên
-- RLS bật ở mức deny-all chỉ để chặn truy cập lậu qua anon/authenticated key.

create extension if not exists vector with schema extensions;
set search_path to public, extensions;

-- ===== Tài khoản & vai trò =====
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'PATIENT' check (role in ('PATIENT', 'DOCTOR')),
  full_name text,
  phone text,
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- ===== Kho thuốc =====
create table medicines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  image_path text,
  cost_price numeric(12, 0) not null check (cost_price >= 0),
  sale_price numeric(12, 0) not null check (sale_price >= 0),
  expiry_date date,
  in_stock boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index idx_medicines_name on medicines using gin (to_tsvector('simple', name));

-- ===== Hồ sơ bệnh nhân (Doctor tạo; walk-in có thể không có tài khoản) =====
create table patients (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles (id),
  full_name text not null,
  phone text,
  age int check (age between 0 and 150),
  photo_path text,
  note text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- ===== Lịch làm việc & lịch hẹn =====
create table doctor_availability (
  id uuid primary key default gen_random_uuid(),
  weekday int not null check (weekday between 0 and 6), -- 0 = Chủ nhật
  start_time time not null,
  end_time time not null,
  slot_minutes int not null default 30 check (slot_minutes > 0)
);

create table appointments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id),
  slot_start timestamptz not null,
  slot_end timestamptz not null,
  status text not null default 'BOOKED'
    check (status in ('BOOKED', 'CONFIRMED', 'DONE', 'CANCELLED')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
-- Chống đặt trùng giờ: chỉ 1 lịch active cho mỗi slot
create unique index uq_appointments_active_slot on appointments (slot_start)
  where status in ('BOOKED', 'CONFIRMED');

create table appointment_documents (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments (id) on delete cascade,
  image_path text not null, -- bucket private medical-docs
  created_at timestamptz not null default now()
);

-- ===== Khám bệnh & đơn thuốc =====
create table prescriptions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients (id),
  appointment_id uuid references appointments (id),
  symptoms text,
  diagnosis text,
  exam_fee numeric(12, 0) not null default 0 check (exam_fee >= 0),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index idx_prescriptions_created on prescriptions (created_at);

create table prescription_images (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references prescriptions (id) on delete cascade,
  image_path text not null, -- bucket private medical-docs
  kind text not null default 'OTHER' check (kind in ('XRAY', 'ECG', 'OTHER')),
  created_at timestamptz not null default now()
);

-- SNAPSHOT tên + giá tại thời điểm kê (D11) — không join giá hiện tại
create table prescription_items (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references prescriptions (id) on delete cascade,
  medicine_id uuid references medicines (id),
  medicine_name text not null,
  quantity int not null default 1 check (quantity > 0),
  dosage text,
  cost_price numeric(12, 0) not null,
  sale_price numeric(12, 0) not null
);

-- ===== Giỏ hàng (chỉ Patient; Customer dùng localStorage) =====
create table cart_items (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  medicine_id uuid not null references medicines (id),
  quantity int not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  unique (profile_id, medicine_id)
);

-- ===== Đơn hàng (nhận tại quầy, không ship) =====
create table orders (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'CONFIRMED', 'READY', 'COMPLETED', 'CANCELLED')),
  pickup_code text not null unique, -- mã đối chiếu khi đến nhận
  total_amount numeric(12, 0) not null default 0,
  payment_method text not null default 'COUNTER' check (payment_method in ('COUNTER')), -- QR: backlog
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  medicine_id uuid references medicines (id),
  medicine_name text not null, -- snapshot
  quantity int not null check (quantity > 0),
  cost_price numeric(12, 0) not null, -- snapshot
  sale_price numeric(12, 0) not null  -- snapshot
);

-- ===== Chat 2 tầng =====
create table conversations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles (id), -- NULL = khách vãng lai
  anon_key uuid,                            -- định danh phiên chat ẩn danh
  status text not null default 'AI'
    check (status in ('AI', 'WAITING_DOCTOR', 'WITH_DOCTOR', 'CLOSED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  check (profile_id is not null or anon_key is not null)
);
create index idx_conversations_status on conversations (status) where status in ('WAITING_DOCTOR', 'WITH_DOCTOR');

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations (id) on delete cascade,
  sender text not null check (sender in ('USER', 'AI', 'DOCTOR')),
  content text not null,
  created_at timestamptz not null default now()
);
create index idx_messages_conversation on messages (conversation_id, created_at);

-- ===== Knowledge base cho RAG =====
create table kb_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null check (category in ('CLINIC', 'DOCTOR', 'SERVICE', 'FAQ')),
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table kb_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references kb_documents (id) on delete cascade,
  content text not null,
  embedding extensions.vector(768) -- Gemini text-embedding-004
);
create index idx_kb_chunks_embedding on kb_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

-- ===== RLS deny-all: chặn truy cập qua anon/authenticated key của Supabase.
-- Backend (role postgres, owner) không bị ảnh hưởng.
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','medicines','patients','doctor_availability','appointments',
    'appointment_documents','prescriptions','prescription_images','prescription_items',
    'cart_items','orders','order_items','conversations','messages','kb_documents','kb_chunks'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;
