import Link from "next/link";
import { CLINIC } from "@/lib/clinic-info";

const STRENGTHS = [
  { icon: "👨‍⚕️", title: "Bác sĩ giàu kinh nghiệm", desc: CLINIC.doctor.experience },
  { icon: "❤️", title: "Tận tâm với bệnh nhân", desc: "Theo dõi sức khỏe cả gia đình, hồ sơ lưu trữ lâu dài" },
  { icon: "📱", title: "Đặt lịch trực tuyến", desc: "Chọn giờ khám trước, không phải xếp hàng chờ đợi" },
  { icon: "💊", title: "Nhà thuốc tại chỗ", desc: "Đặt thuốc online, nhận ngay tại phòng khám" },
];

const STEPS = [
  { step: "1", title: "Đặt lịch", desc: "Chọn ngày giờ trống trên website, gửi kèm giấy khám nếu có" },
  { step: "2", title: "Đến khám", desc: "Đến đúng giờ hẹn, bác sĩ khám và tư vấn trực tiếp" },
  { step: "3", title: "Nhận đơn thuốc", desc: "Đơn thuốc điện tử lưu trong tài khoản, nhận thuốc tại quầy" },
  { step: "4", title: "Theo dõi", desc: "Xem lại lịch sử khám, hỏi đáp với bác sĩ qua tư vấn online" },
];

const SERVICES = [
  { icon: "🩺", title: "Khám nội tổng quát", desc: "Khám, chẩn đoán và điều trị các bệnh lý nội khoa thường gặp" },
  { icon: "👶", title: "Khám nhi", desc: "Chăm sóc sức khỏe trẻ em, tư vấn dinh dưỡng và tiêm chủng" },
  { icon: "📈", title: "Điện tâm đồ", desc: "Đo điện tim phát hiện sớm các bất thường tim mạch" },
  { icon: "🏠", title: "Bác sĩ gia đình", desc: "Theo dõi sức khỏe định kỳ cho cả gia đình bạn" },
  { icon: "💬", title: "Tư vấn trực tuyến", desc: "Chat với trợ lý AI 24/7 hoặc trực tiếp với bác sĩ", href: "/chat" },
  { icon: "💊", title: "Nhà thuốc", desc: "Thuốc chính hãng, đặt online nhận tại phòng khám", href: "/medicines" },
];

export default function Home() {
  return (
    <div className="-mx-4 -my-6">
      {/* ===== Hero ===== */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-800 via-blue-700 to-blue-500 text-white">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/10" />
        <div className="absolute -bottom-32 -left-16 w-80 h-80 rounded-full bg-white/5" />
        <div className="relative max-w-6xl mx-auto px-4 py-20 md:py-28 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <p className="inline-block bg-white/15 rounded-full px-4 py-1 text-sm mb-4">
              ⚕ {CLINIC.name}
            </p>
            <h1 className="text-3xl md:text-5xl font-bold leading-tight">
              Sức khỏe của bạn —<br />
              <span className="text-amber-400">Sứ mệnh của chúng tôi</span>
            </h1>
            <p className="mt-4 text-blue-100 md:text-lg max-w-md">
              Khám chữa bệnh tận tâm cho cả gia đình. Đặt lịch trước, khám đúng giờ,
              hồ sơ bệnh án lưu trữ trọn đời.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/booking"
                className="bg-amber-500 hover:bg-amber-600 text-white font-semibold px-7 py-3.5 rounded-full shadow-lg"
              >
                Đặt lịch ngay
              </Link>
              <Link
                href="/chat"
                className="border-2 border-white/60 hover:bg-white/10 px-7 py-3.5 rounded-full font-medium"
              >
                💬 Tư vấn miễn phí
              </Link>
            </div>
            <p className="mt-6 text-sm text-blue-200">
              Hotline: <a href={CLINIC.phoneHref} className="font-bold text-white">{CLINIC.phone}</a>
              {" · "}{CLINIC.workingHours[0].days} {CLINIC.workingHours[0].hours}
            </p>
          </div>
          <div className="hidden md:flex justify-center">
            <div className="w-72 h-72 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-[10rem] select-none">
              🩺
            </div>
          </div>
        </div>
      </section>

      {/* ===== 4 điểm mạnh ===== */}
      <section className="max-w-6xl mx-auto px-4 -mt-10 relative z-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {STRENGTHS.map((s) => (
            <div key={s.title} className="bg-white rounded-2xl shadow-md border border-blue-50 p-5 text-center">
              <div className="text-4xl mb-2">{s.icon}</div>
              <p className="font-semibold text-blue-900">{s.title}</p>
              <p className="text-sm text-gray-500 mt-1">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== Quy trình ===== */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-2xl md:text-3xl font-bold text-center text-blue-900">Quy trình khám bệnh</h2>
        <p className="text-center text-gray-500 mt-2 mb-10">4 bước đơn giản, tiết kiệm thời gian của bạn</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {STEPS.map((s) => (
            <div key={s.step} className="relative bg-blue-50 rounded-2xl p-6 pt-8">
              <span className="absolute -top-4 left-6 w-9 h-9 rounded-full bg-blue-700 text-white font-bold flex items-center justify-center shadow">
                {s.step}
              </span>
              <p className="font-semibold text-blue-900">{s.title}</p>
              <p className="text-sm text-gray-600 mt-1.5">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== Dịch vụ ===== */}
      <section id="services" className="bg-white py-16 scroll-mt-24">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-blue-900">Dịch vụ y tế</h2>
          <p className="text-center text-gray-500 mt-2 mb-10">Chăm sóc sức khỏe toàn diện cho cả gia đình</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {SERVICES.map((sv) => {
              const inner = (
                <div className="h-full bg-gradient-to-b from-blue-50 to-white border border-blue-100 rounded-2xl p-6 hover:shadow-lg hover:-translate-y-0.5 transition">
                  <div className="w-12 h-12 rounded-xl bg-blue-700 text-white text-2xl flex items-center justify-center mb-4">
                    {sv.icon}
                  </div>
                  <p className="font-semibold text-blue-900">{sv.title}</p>
                  <p className="text-sm text-gray-600 mt-1.5">{sv.desc}</p>
                  {sv.href && <p className="text-sm text-blue-700 font-medium mt-3">Xem ngay →</p>}
                </div>
              );
              return sv.href ? (
                <Link key={sv.title} href={sv.href}>{inner}</Link>
              ) : (
                <div key={sv.title}>{inner}</div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== Giới thiệu bác sĩ ===== */}
      <section className="max-w-6xl mx-auto px-4 py-16 grid md:grid-cols-2 gap-10 items-center">
        <div className="flex justify-center">
          <div className="w-56 h-56 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 border-4 border-white shadow-xl flex items-center justify-center text-8xl select-none">
            👨‍⚕️
          </div>
        </div>
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-blue-900">{CLINIC.doctor.name}</h2>
          <p className="text-blue-700 font-medium mt-1">{CLINIC.doctor.title}</p>
          <p className="text-gray-600 mt-4 leading-relaxed">
            Tốt nghiệp Đại học Y Dược TP.HCM với {CLINIC.doctor.experience.toLowerCase()}.
            Phương châm khám bệnh: lắng nghe kỹ, giải thích rõ, chỉ định đúng — không lạm dụng
            thuốc và xét nghiệm.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-gray-700">
            <li>✅ Khám nội tổng quát người lớn và trẻ em</li>
            <li>✅ Quản lý bệnh mạn tính: tăng huyết áp, đái tháo đường</li>
            <li>✅ Tư vấn sức khỏe từ xa qua website</li>
          </ul>
          <Link
            href="/booking"
            className="inline-block mt-6 bg-blue-700 hover:bg-blue-800 text-white font-medium px-6 py-3 rounded-full"
          >
            Đặt lịch với bác sĩ
          </Link>
        </div>
      </section>

      {/* ===== CTA band ===== */}
      <section className="bg-gradient-to-r from-blue-800 to-blue-600 text-white">
        <div className="max-w-6xl mx-auto px-4 py-12 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-2xl font-bold">Đặt khám nhanh — không chờ đợi</h2>
            <p className="text-blue-100 mt-1">
              Chọn khung giờ trống theo thời gian thực, gửi trước giấy khám sức khỏe cho bác sĩ.
            </p>
          </div>
          <div className="flex gap-3 shrink-0">
            <Link
              href="/booking"
              className="bg-amber-500 hover:bg-amber-600 font-semibold px-6 py-3 rounded-full shadow"
            >
              Đặt lịch ngay
            </Link>
            <a
              href={CLINIC.phoneHref}
              className="border-2 border-white/60 hover:bg-white/10 px-6 py-3 rounded-full font-medium"
            >
              ☎ {CLINIC.phone}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
