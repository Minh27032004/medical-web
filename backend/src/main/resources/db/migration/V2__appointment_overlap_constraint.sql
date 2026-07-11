-- V2: Cho phép bệnh nhân tự nhập giờ khám (không còn lưới slot cố định)
-- → cần chặn CHỒNG LẤN khoảng thời gian ở tầng DB, không chỉ trùng giờ bắt đầu.
-- Exclusion constraint: hai lịch active không được giao nhau về khoảng [start, end).

create extension if not exists btree_gist;

alter table appointments
  add constraint no_overlap_active_appointments
  exclude using gist (tstzrange(slot_start, slot_end) with &&)
  where (status in ('BOOKED', 'CONFIRMED'));

-- Index unique theo slot_start cũ giờ thừa (constraint mới bao trùm) — gỡ để khỏi rối
drop index if exists uq_appointments_active_slot;
