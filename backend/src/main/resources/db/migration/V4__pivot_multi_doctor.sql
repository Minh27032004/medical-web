-- V4: PIVOT sang hệ nội bộ multi-doctor (docs/DECISIONS.md D13-D16, docs/FEATURES.md)
-- Gỡ toàn bộ phần dành cho bệnh nhân; dữ liệu cũ là dữ liệu test nên drop thẳng.

-- ===== 1. Dọn schema cũ =====
drop table if exists cart_items cascade;
drop table if exists order_items cascade;
drop table if exists orders cascade;
drop table if exists appointment_documents cascade;
drop table if exists appointments cascade;
drop table if exists doctor_availability cascade;
drop table if exists prescription_images cascade;
drop table if exists prescription_items cascade;
drop table if exists prescriptions cascade;
drop table if exists patients cascade;
drop table if exists medicines cascade;
drop table if exists kb_chunks cascade;
drop table if exists kb_documents cascade;
drop table if exists messages cascade;
drop table if exists conversations cascade;
drop table if exists notifications cascade;

-- ===== 2. profiles → users (mở rộng theo đặc tả §4.1) =====
-- password do Supabase Auth quản (D15) — không có cột password_hash.
alter table profiles rename to users;
alter table users drop column if exists avatar_path;
alter table users add column username text unique;
alter table users add column clinic_name text;
alter table users add column is_blocked boolean not null default false;
alter table users drop constraint if exists profiles_role_check;
update users set role = 'DOCTOR' where role not in ('ADMIN', 'DOCTOR');
alter table users add constraint users_role_check check (role in ('ADMIN', 'DOCTOR'));

-- Tài khoản admin đầu tiên: tái dùng auth user admin@clinic.local đã có
update users u set role = 'ADMIN', username = 'admin',
  full_name = coalesce(u.full_name, 'Quản trị viên')
from auth.users au where u.id = au.id and au.email = 'admin@clinic.local';
-- Các tài khoản test cũ khác (patient...) không còn vai trò → xóa row nghiệp vụ
delete from users where username is null;

-- ===== 3. Bệnh nhân (§4.2 — phòng khám người lớn) =====
create table patients (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references users (id),
  full_name text not null,
  phone text,
  gender text check (gender in ('male', 'female', 'other')),
  address text,
  has_drug_allergy boolean not null default false,
  drug_allergy_note text,
  has_chronic_condition boolean not null default false,
  chronic_condition_note text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index idx_patients_doctor_name on patients (doctor_id, full_name);
create index idx_patients_doctor_phone on patients (doctor_id, phone);

-- ===== 4. Kho thuốc (§4.6, §4.7) =====
create table medicines (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references users (id),
  name text not null,
  is_injection boolean not null default false, -- true → chỉ đơn vị 'ong'
  base_unit text not null,                     -- đơn vị nhỏ nhất (viên/gói/ống...)
  stock_base_qty numeric not null default 0,   -- LUÔN theo đơn vị nhỏ nhất; cho phép ÂM (D16)
  low_stock_threshold int not null default 30,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index idx_medicines_doctor_name on medicines (doctor_id, name);

create table medicine_units (
  id uuid primary key default gen_random_uuid(),
  medicine_id uuid not null references medicines (id) on delete cascade,
  unit_name text not null check (unit_name in ('chai', 'hop', 'vi', 'vien', 'goi', 'ong')),
  level_order int not null,        -- lớn→nhỏ: chai=1, hộp=2, vĩ=3, viên=4, gói=5; ống riêng
  factor_to_base numeric not null, -- số đơn vị base trong 1 đơn vị này (base = 1)
  unique (medicine_id, unit_name)
);

-- ===== 5. Thuốc mẫu (§4.8) =====
create table medicine_templates (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references users (id),
  medicine_id uuid references medicines (id),
  name text not null,
  default_dose_morning numeric not null default 0,
  default_dose_noon numeric not null default 0,
  default_dose_afternoon numeric not null default 0,
  default_dose_evening numeric not null default 0,
  default_usage_note text,
  default_num_days int,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_templates_doctor on medicine_templates (doctor_id, name);

-- ===== 6. Lần khám (§4.3) =====
create table visits (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references users (id),
  patient_id uuid not null references patients (id),
  visit_date timestamptz not null default now(),
  diagnosis_code text not null, -- ICD-10, BẮT BUỘC
  diagnosis_name text not null, -- snapshot tên tại thời điểm khám
  note text,
  created_at timestamptz not null default now()
);
create index idx_visits_doctor_date on visits (doctor_id, visit_date desc);
create index idx_visits_patient on visits (patient_id, visit_date desc);

-- ===== 7. Đơn thuốc 1:1 lần khám (§4.4, §4.5) =====
create table prescriptions (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references users (id),
  visit_id uuid not null unique references visits (id),
  created_at timestamptz not null default now(),
  printed_at timestamptz
);

create table prescription_items (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references prescriptions (id) on delete cascade,
  medicine_id uuid references medicines (id), -- null = thuốc ngoài kho, không trừ tồn
  medicine_name text not null,                -- snapshot
  base_unit text not null,                    -- snapshot
  dose_morning numeric not null default 0,
  dose_noon numeric not null default 0,
  dose_afternoon numeric not null default 0,
  dose_evening numeric not null default 0,
  special_dose_text text,
  usage_note text,
  num_days int,
  total_quantity_base numeric not null default 0,
  is_injection boolean not null default false
);

-- ===== 8. ICD-10 (§4.9 — dùng chung, seed rút gọn các mã ngoại trú phổ biến) =====
-- Bổ sung thêm mã bằng: insert into icd10_codes values ('MA','Tên') on conflict do nothing;
create table icd10_codes (
  code text primary key,
  name text not null
);
create index idx_icd10_name on icd10_codes using gin (to_tsvector('simple', name));

insert into icd10_codes (code, name) values
('J00', 'Viêm mũi họng cấp [cảm thường]'),
('J01', 'Viêm xoang cấp'),
('J02', 'Viêm họng cấp'),
('J03', 'Viêm amidan cấp'),
('J04', 'Viêm thanh quản và khí quản cấp'),
('J06', 'Nhiễm khuẩn đường hô hấp trên cấp, nhiều vị trí'),
('J11', 'Cúm do virus không định danh'),
('J18', 'Viêm phổi, tác nhân không xác định'),
('J20', 'Viêm phế quản cấp'),
('J30', 'Viêm mũi vận mạch và viêm mũi dị ứng'),
('J32', 'Viêm xoang mạn'),
('J40', 'Viêm phế quản, không xác định cấp hay mạn'),
('J44', 'Bệnh phổi tắc nghẽn mạn tính khác'),
('J45', 'Hen [suyễn]'),
('I10', 'Tăng huyết áp vô căn (nguyên phát)'),
('I11', 'Bệnh tim do tăng huyết áp'),
('I20', 'Cơn đau thắt ngực'),
('I25', 'Bệnh tim thiếu máu cục bộ mạn'),
('I48', 'Rung nhĩ và cuồng nhĩ'),
('I50', 'Suy tim'),
('I63', 'Nhồi máu não'),
('I67', 'Bệnh mạch máu não khác'),
('K64', 'Trĩ và huyết khối tĩnh mạch quanh hậu môn'),
('E03', 'Suy giáp khác'),
('E04', 'Bướu giáp không độc khác'),
('E05', 'Nhiễm độc giáp [cường giáp]'),
('E10', 'Đái tháo đường típ 1'),
('E11', 'Đái tháo đường típ 2'),
('E66', 'Béo phì'),
('E78', 'Rối loạn chuyển hóa lipoprotein (rối loạn mỡ máu)'),
('A08', 'Nhiễm virus đường ruột khác'),
('A09', 'Viêm dạ dày-ruột và đại tràng do nhiễm khuẩn'),
('K21', 'Bệnh trào ngược dạ dày - thực quản'),
('K25', 'Loét dạ dày'),
('K26', 'Loét tá tràng'),
('K29', 'Viêm dạ dày và tá tràng'),
('K30', 'Khó tiêu chức năng'),
('K52', 'Viêm dạ dày-ruột và đại tràng không nhiễm khuẩn khác'),
('K58', 'Hội chứng ruột kích thích'),
('K59', 'Táo bón và rối loạn chức năng ruột khác'),
('K76', 'Bệnh gan khác'),
('B18', 'Viêm gan virus mạn'),
('M10', 'Gút'),
('M13', 'Viêm khớp khác'),
('M15', 'Thoái hóa đa khớp'),
('M16', 'Thoái hóa khớp háng'),
('M17', 'Thoái hóa khớp gối'),
('M25', 'Rối loạn khớp khác, không phân loại nơi khác'),
('M47', 'Thoái hóa cột sống'),
('M54', 'Đau lưng'),
('M54.5', 'Đau thắt lưng'),
('M62', 'Rối loạn cơ khác'),
('M79', 'Bệnh mô mềm khác, không phân loại nơi khác'),
('G43', 'Đau nửa đầu [Migraine]'),
('G44', 'Hội chứng đau đầu khác'),
('G47', 'Rối loạn giấc ngủ'),
('F32', 'Giai đoạn trầm cảm'),
('F41', 'Rối loạn lo âu khác'),
('N18', 'Bệnh thận mạn'),
('N20', 'Sỏi thận và niệu quản'),
('N30', 'Viêm bàng quang'),
('N39', 'Rối loạn khác của hệ tiết niệu (gồm nhiễm khuẩn tiết niệu)'),
('N40', 'Tăng sản tuyến tiền liệt'),
('N76', 'Viêm âm đạo và âm hộ khác'),
('N95', 'Rối loạn mãn kinh và quanh mãn kinh'),
('L02', 'Áp xe da, nhọt và nhọt cụm'),
('L20', 'Viêm da cơ địa'),
('L23', 'Viêm da tiếp xúc dị ứng'),
('L30', 'Viêm da khác'),
('L50', 'Mày đay'),
('B35', 'Nấm da'),
('H10', 'Viêm kết mạc'),
('H66', 'Viêm tai giữa mủ và không xác định'),
('H81', 'Rối loạn chức năng tiền đình'),
('A90', 'Sốt Dengue [sốt xuất huyết cổ điển]'),
('B01', 'Thủy đậu'),
('B02', 'Zona'),
('R05', 'Ho'),
('R10', 'Đau bụng và vùng chậu'),
('R11', 'Buồn nôn và nôn'),
('R42', 'Chóng mặt và choáng váng'),
('R50', 'Sốt không rõ nguyên nhân'),
('R51', 'Đau đầu'),
('R53', 'Khó ở và mệt mỏi'),
('T78', 'Tác dụng có hại, không phân loại nơi khác (dị ứng)'),
('Z00', 'Khám sức khỏe tổng quát');

-- ===== 9. RLS deny-all cho bảng mới (backend là owner nên không bị chặn) =====
do $$
declare t text;
begin
  foreach t in array array[
    'patients','medicines','medicine_units','medicine_templates',
    'visits','prescriptions','prescription_items','icd10_codes'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;
