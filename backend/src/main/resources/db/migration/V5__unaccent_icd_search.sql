-- V5: tìm ICD-10 theo tên KHÔNG DẤU (bác sĩ gõ "tang huyet ap" ra "Tăng huyết áp").
-- Bảng icd10 nhỏ (~vài trăm dòng) nên seq scan với unaccent là đủ nhanh, không cần index.
create extension if not exists unaccent with schema extensions;
