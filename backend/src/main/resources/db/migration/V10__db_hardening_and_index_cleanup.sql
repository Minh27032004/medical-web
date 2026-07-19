-- V10: vá bảo mật + dọn index sau rà soát DB (2026-07-19)

-- ===== 1. chat_messages quên bật RLS ở V9 =====
-- Mọi bảng public đều deny-all (V1, V4) để chặn truy cập qua anon/authenticated key
-- của Supabase Data API; bảng này chứa tên bệnh nhân trong param_name/question.
alter table chat_messages enable row level security;

-- ===== 2. Index FK cho bảng tăng nhanh nhất =====
-- Postgres KHÔNG tự tạo index cho cột FK. Mọi lần xem chi tiết/in đơn/copy đơn
-- và query visitIdsWithInjection đều tìm item theo prescription_id.
create index idx_prescription_items_prescription
  on prescription_items (prescription_id);

-- ===== 3. Bỏ index chết =====
-- Query icd10 dùng unaccent(lower(name)) like '%q%' (V5, native) — GIN tsvector
-- không bao giờ được dùng; bảng nhỏ, seq scan đủ nhanh (ghi chú V5).
drop index if exists idx_icd10_name;
-- Search SĐT dùng like '%q%' và findDuplicateIds so trim(phone) — btree không
-- dùng được; prefix doctor_id đã có ở idx_patients_doctor_name.
drop index if exists idx_patients_doctor_phone;

-- ===== 4. Index soft-delete → partial =====
-- Mọi query đều kèm "deleted_at is null" → partial index nhỏ hơn (bỏ row đã xóa)
-- và khớp đúng predicate.
drop index if exists idx_patients_doctor_name;
create index idx_patients_doctor_name
  on patients (doctor_id, full_name) where deleted_at is null;

drop index if exists idx_medicines_doctor_name;
create index idx_medicines_doctor_name
  on medicines (doctor_id, name) where deleted_at is null;

drop index if exists idx_templates_doctor;
create index idx_templates_doctor
  on medicine_templates (doctor_id, name) where deleted_at is null;

-- ===== 5. Gỡ extension vector còn sót từ V1 =====
-- kb_chunks (RAG) đã drop ở V4 (D13) — không còn object nào phụ thuộc.
drop extension if exists vector;
