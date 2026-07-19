-- V11: loại thuốc TRUYỀN DỊCH (bên cạnh uống/tiêm) — đơn vị mặc định 'chai',
-- không quy đổi (giống thuốc tiêm chỉ dùng 'ống'). 'chai' đã có sẵn trong
-- check constraint của medicine_units nên không cần sửa.
alter table medicines add column is_infusion boolean not null default false;
-- Snapshot trên dòng đơn thuốc — đơn cũ bất biến.
alter table prescription_items add column is_infusion boolean not null default false;
