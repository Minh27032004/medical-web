/**
 * Thông tin phòng khám — SỬA TẠI ĐÂY, mọi trang (header, footer, landing, liên hệ)
 * đều đọc từ file này. Nhớ cập nhật cả tài liệu Chatbot (/doctor/kb) cho khớp.
 */
export const CLINIC = {
  name: "Phòng Khám Gia Đình",
  shortName: "Phòng Khám Gia Đình",
  slogan: "Sức khỏe của bạn — Sứ mệnh của chúng tôi",
  address: "An Hòa, Đồng Tháp, Việt Nam",
  phone: "0907 729 127",
  phoneHref: "tel:0907729127",
  email: "phongkham@example.com",
  workingHours: [
    { days: "Thứ 2 — Thứ 7", hours: "Sáng 6:00 – 7:30" },
    { days: "Thứ 2 — Thứ 7", hours: "Chiều 16:30 – 19:30" },
    { days: "Chủ nhật", hours: "Làm cả ngày" },
  ],
  doctor: {
    name: "BS. Trần Nhựt Minh",
    title: "Bác sĩ Chuyên khoa I",
    education: "Tốt nghiệp Đại học Y Dược Cần Thơ",
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
