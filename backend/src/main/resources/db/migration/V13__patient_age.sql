-- V13: tuổi bệnh nhân — TÙY CHỌN (null = chưa hỏi/không ghi).
-- Lưu tuổi thay vì ngày sinh theo yêu cầu nghiệp vụ: phòng khám hỏi nhanh "bao nhiêu tuổi".
-- Đánh đổi: con số này KHÔNG tự tăng theo thời gian, bác sĩ cập nhật lại khi tái khám.
alter table patients add column age int;
alter table patients add constraint patients_age_range check (age is null or (age >= 0 and age <= 150));
