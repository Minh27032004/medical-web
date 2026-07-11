/**
 * Thông tin phòng khám — SỬA TẠI ĐÂY, mọi trang (header, footer, landing, liên hệ)
 * đều đọc từ file này. Nhớ cập nhật cả tài liệu Chatbot (/doctor/kb) cho khớp.
 */
export const CLINIC = {
  name: "Phòng Khám Gia Đình BS Minh",
  shortName: "PK BS Minh",
  slogan: "Sức khỏe của bạn — Sứ mệnh của chúng tôi",
  address: "An Hòa, Đồng Tháp, Việt Nam",
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
  map: {
    lat: 10.746525519916984,
    lng: 105.38723131854084,
    /** Iframe Google Maps — không cần API key */
    embedUrl:
      "https://maps.google.com/maps?q=10.746525519916984,105.38723131854084&z=17&hl=vi&output=embed",
    /** Link chia sẻ chính thức của phòng khám trên Google Maps */
    directionsUrl: "https://maps.app.goo.gl/ofCMo2C9YAbjw4nG9",
  },
};
