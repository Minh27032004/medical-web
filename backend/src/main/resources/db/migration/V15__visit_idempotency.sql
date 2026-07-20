-- V15: chống TẠO TRÙNG lần khám khi mạng chập chờn.
--
-- Kịch bản có thật: POST /visits tới được server, lần khám đã tạo và kho đã bị trừ, nhưng
-- phản hồi không về tới trình duyệt (timeout, Render rớt kết nối, wifi phòng khám chập).
-- Frontend báo "Lưu thất bại", bác sĩ bấm Lưu lần nữa → lần khám thứ hai + trừ kho hai lần.
-- Hồ sơ bệnh nhân có bản ghi ma, tồn kho sai. Không có gì báo cho ai biết.
--
-- Frontend sinh client_request_id một lần cho mỗi phiên mở form; gửi lại cùng id thì backend
-- trả về lần khám đã tạo thay vì tạo mới.
alter table visits add column client_request_id uuid;

-- Partial unique: chỉ ràng buộc khi có id (lần khám cũ và các đường tạo khác vẫn null được).
create unique index uq_visits_doctor_client_request
  on visits (doctor_id, client_request_id)
  where client_request_id is not null;
