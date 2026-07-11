-- V3: (1) Cho phép nhiều bệnh nhân đặt CÙNG khung giờ — phòng khám khám theo thứ tự đến,
--     nên gỡ ràng buộc chống chồng lấn của V2.
--     (2) Bảng thông báo cho bác sĩ (chuông trên header): lịch hẹn mới, đơn hàng mới,
--     bệnh nhân chờ tư vấn. Phòng khám 1 bác sĩ nên không cần cột người nhận.

alter table appointments drop constraint if exists no_overlap_active_appointments;

create table notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('NEW_APPOINTMENT', 'NEW_ORDER', 'CHAT_WAITING')),
  title text not null,
  body text,
  link text, -- đường dẫn frontend để bấm nhảy tới
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_notifications_unread on notifications (created_at desc) where read_at is null;

alter table notifications enable row level security;
