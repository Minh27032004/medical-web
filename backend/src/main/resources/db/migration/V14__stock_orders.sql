-- V14: ĐƠN NHẬP KHO. Bác sĩ lập đơn (nhanh từ thuốc sắp hết, hoặc thủ công), xuất file
-- gửi nhà thuốc, đơn nằm ở trạng thái chờ; nhận đủ hàng thì xác nhận → cộng tồn kho.
--
-- Vì sao cần bảng riêng thay vì cộng thẳng vào kho: giữa lúc đặt và lúc hàng về có độ trễ.
-- Cộng ngay sẽ khiến tồn trên hệ thống cao hơn thuốc thật trong tủ, dẫn tới kê đơn cho
-- bệnh nhân dựa trên số ảo. Đơn ở trạng thái chờ không đụng gì tới tồn.
create table stock_orders (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references users (id),
  code text not null,                       -- mã hiển thị/in ra file, vd NK-20260720-01
  status text not null default 'PENDING'
    check (status in ('PENDING', 'RECEIVED', 'CANCELLED')),
  source text not null check (source in ('QUICK', 'MANUAL')),
  note text,
  created_at timestamptz not null default now(),
  received_at timestamptz,
  cancelled_at timestamptz,
  unique (doctor_id, code)
);
create index idx_stock_orders_doctor on stock_orders (doctor_id, created_at desc);

-- KHÔNG lưu factor_to_base: số lượng quy về đơn vị nhỏ nhất phải tính theo tỷ lệ HIỆN TẠI
-- lúc xác nhận. Nếu bác sĩ sửa "1 hộp = 50 viên" thành 60 viên trong lúc chờ hàng thì
-- 10 hộp nhận về đúng là 600 viên, không phải 500 theo tỷ lệ cũ.
-- Tên thuốc/đơn vị vẫn snapshot để file đã xuất và đơn cũ đọc lại không đổi nghĩa.
create table stock_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references stock_orders (id) on delete cascade,
  medicine_id uuid references medicines (id),
  medicine_name text not null,
  unit_name text not null,
  unit_label text not null,
  qty numeric not null check (qty > 0)
);
create index idx_stock_order_items_order on stock_order_items (order_id);
