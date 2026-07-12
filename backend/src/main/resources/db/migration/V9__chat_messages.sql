-- V9: lưu hội thoại trợ lý chat để (1) hiển thị lại khi mở, (2) cấp NGỮ CẢNH cho lượt hỏi sau
-- (ví dụ: "tháng này anh A khám mấy lần?" → "có mấy lần tiêm?" vẫn hiểu đối tượng là anh A).
-- Chỉ lưu câu hỏi + intent + tham số đã trích + tóm tắt trả lời (KHÔNG lưu bảng kết quả).
create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references users (id),
  question text not null,
  intent text,
  param_name text,        -- tên bệnh nhân/thuốc đã trích — để lượt sau kế thừa "anh A"
  param_from date,
  param_to date,
  answer_summary text,    -- tiêu đề/thông điệp trả lời, đủ để nhớ ngữ cảnh
  created_at timestamptz not null default now()
);

-- Nạp nhanh "5 lượt gần nhất theo bác sĩ".
create index idx_chat_messages_doctor_created on chat_messages (doctor_id, created_at desc);
