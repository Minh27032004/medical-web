-- V16: cắt NGỮ CẢNH trợ lý theo phiên chat.
--
-- Trước đây ngữ cảnh lấy 5 lượt gần nhất của bác sĩ, bất kể cách nhau bao lâu. Mở chat sáng
-- nay hỏi "tháng này khám mấy lần?" thì Gemini kế thừa tên bệnh nhân của phiên CHIỀU HÔM QUA
-- và trả lời về đúng người đó — không sai cú pháp, không báo lỗi, chỉ là trả lời nhầm người.
-- Với dữ liệu y tế thì kiểu nhầm lặng lẽ này nguy hiểm.
--
-- Frontend sinh session_id mỗi lần mở chat; ngữ cảnh chỉ lấy trong cùng phiên.
alter table chat_messages add column session_id uuid;

create index idx_chat_messages_session
  on chat_messages (doctor_id, session_id, created_at desc);
