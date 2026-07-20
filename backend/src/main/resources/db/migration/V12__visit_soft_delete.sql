-- V12: XÓA MỀM lần khám. Hồ sơ y tế không xóa cứng (CLAUDE.md) — chỉ ẩn khỏi lịch sử.
-- prescriptions/prescription_items GIỮ NGUYÊN: đơn đã in là bất biến, ẩn theo visit cha.
alter table visits add column deleted_at timestamptz;

-- Mọi truy vấn lịch sử từ nay đều kèm "deleted_at is null" → chuyển 2 index chính sang
-- partial index: nhỏ hơn và khớp đúng mệnh đề where (Postgres chỉ dùng được khi predicate khớp).
drop index if exists idx_visits_doctor_date;
drop index if exists idx_visits_patient;
create index idx_visits_doctor_date on visits (doctor_id, visit_date desc) where deleted_at is null;
create index idx_visits_patient on visits (patient_id, visit_date desc) where deleted_at is null;
