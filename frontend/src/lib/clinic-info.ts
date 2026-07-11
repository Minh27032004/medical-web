/**
 * Thông tin phòng khám — SỬA TẠI ĐÂY, mọi trang (header, footer, landing, liên hệ)
 * đều đọc từ file này. Nhớ cập nhật cả tài liệu Chatbot (/doctor/kb) cho khớp.
 */
export const CLINIC = {
  name: "Phòng Khám Gia Đình BS Minh",
  shortName: "PK BS Minh",
  slogan: "Sức khỏe của bạn — Sứ mệnh của chúng tôi",
  address: "123 Nguyễn Trãi, Phường 7, Quận 5, TP.HCM",
  phone: "0907 729 127",
  phoneHref: "tel:0907729127",
  email: "phongkham@example.com",
  workingHours: [
    { days: "Thứ 2 — Thứ 7", hours: "Sáng 8:00 – 11:30" },
    { days: "Thứ 2", hours: "Chiều 14:00 – 17:00" },
    { days: "Chủ nhật", hours: "Nghỉ" },
  ],
  doctor: {
    name: "BS. Trần Nhựt Minh",
    title: "Chuyên khoa Nội tổng quát — Nhi khoa",
    experience: "15 năm kinh nghiệm khám và điều trị",
  },
};
