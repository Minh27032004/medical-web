-- V7: chẩn đoán phụ (nhiều mã ICD-10) cho lần khám — snapshot code+name dạng jsonb.
-- Chẩn đoán CHÍNH vẫn ở cột diagnosis_code / diagnosis_name (bắt buộc, 1 mã).
alter table visits
  add column secondary_diagnoses jsonb not null default '[]'::jsonb;
