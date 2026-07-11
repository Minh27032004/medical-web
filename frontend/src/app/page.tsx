import Image from "next/image";
import Link from "next/link";
import FadeIn from "@/components/magicui/FadeIn";
import Marquee from "@/components/magicui/Marquee";
import NumberTicker from "@/components/magicui/NumberTicker";
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
  { icon: "💊", title: "Nhà thuốc", desc: "Thuốc chính hãng, đặt online nhận tại phòng khám", href: "/medicines", image: "/images/pharmacy.jpg" },
];

// TODO: thay bằng đánh giá thật của bệnh nhân phòng khám
const TESTIMONIALS = [
  { name: "Chị Hương", text: "Bác sĩ khám rất kỹ, giải thích dễ hiểu. Đặt lịch online nên không phải chờ." },
  { name: "Anh Tuấn", text: "Đưa con đi khám, bác sĩ nhẹ nhàng, bé không sợ. Đơn thuốc lưu trên web xem lại tiện lắm." },
  { name: "Cô Sáu", text: "Lớn tuổi đi lại khó, nhắn tin hỏi trước được bác sĩ trả lời tận tình." },
  { name: "Chị Ngọc", text: "Mua thuốc đặt trên mạng, ra tới nơi đọc mã là nhận liền, khỏi xếp hàng." },
  { name: "Anh Phát", text: "Phòng khám sạch sẽ, đúng giờ hẹn. Giá khám niêm yết rõ ràng." },
  { name: "Bạn Minh Anh", text: "Chatbot trả lời nhanh mấy câu về giờ giấc, hỏi bệnh thì được chuyển cho bác sĩ luôn." },
];

export default function Home() {
  return (
    <div className="-mx-4 -my-6">
      {/* ===== Hero ===== */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-800 via-blue-700 to-blue-500 text-white">
        <div className="animate-blob absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/10" />
        <div className="absolute -bottom-32 -left-16 w-80 h-80 rounded-full bg-white/5" />
        <div className="relative max-w-6xl mx-auto px-4 py-16 md:py-24 grid md:grid-cols-2 gap-10 items-center">
          <FadeIn>
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
                className="shimmer-btn bg-amber-500 hover:bg-amber-600 text-white font-semibold px-7 py-3.5 rounded-full shadow-lg"
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
          </FadeIn>
          <FadeIn delay={0.15} className="hidden md:block">
            {/* TODO: thay bằng ảnh thật của phòng khám / bác sĩ */}
            <div className="relative mx-auto w-fit">
              <div className="absolute -inset-3 rounded-3xl bg-white/15 rotate-2" />
              <Image
                src="/images/doctor-hero.jpg"
                alt="Bác sĩ phòng khám"
                width={440}
                height={300}
                priority
                className="relative rounded-3xl shadow-2xl object-cover w-105 h-80"
              />
              <div className="absolute -bottom-5 -left-5 bg-white text-blue-900 rounded-2xl shadow-lg px-4 py-3 text-sm">
                <p className="font-bold">✓ Đặt lịch hôm nay</p>
                <p className="text-gray-500">Khám đúng giờ, không chờ đợi</p>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ===== 4 điểm mạnh ===== */}
      <section className="max-w-6xl mx-auto px-4 -mt-10 relative z-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {STRENGTHS.map((s, i) => (
            <FadeIn key={s.title} delay={i * 0.08}>
              <div className="h-full bg-white rounded-2xl shadow-md border border-blue-50 p-5 text-center">
                <div className="text-4xl mb-2">{s.icon}</div>
                <p className="font-semibold text-blue-900">{s.title}</p>
                <p className="text-sm text-gray-500 mt-1">{s.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ===== Số liệu ===== */}
      <section className="max-w-6xl mx-auto px-4 pt-14">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-3xl md:text-4xl font-bold text-blue-800">
              <NumberTicker value={15} suffix="+" />
            </p>
            <p className="text-sm text-gray-500 mt-1">Năm kinh nghiệm</p>
          </div>
          <div>
            <p className="text-3xl md:text-4xl font-bold text-blue-800">
              <NumberTicker value={6} />
            </p>
            <p className="text-sm text-gray-500 mt-1">Dịch vụ y tế</p>
          </div>
          <div>
            <p className="text-3xl md:text-4xl font-bold text-blue-800">
              <NumberTicker value={100} suffix="%" />
            </p>
            <p className="text-sm text-gray-500 mt-1">Đặt lịch trực tuyến</p>
          </div>
        </div>
      </section>

      {/* ===== Quy trình ===== */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <FadeIn>
          <h2 className="text-2xl md:text-3xl font-bold text-center text-blue-900">Quy trình khám bệnh</h2>
          <p className="text-center text-gray-500 mt-2 mb-10">4 bước đơn giản, tiết kiệm thời gian của bạn</p>
        </FadeIn>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {STEPS.map((s, i) => (
            <FadeIn key={s.step} delay={i * 0.1}>
              <div className="relative h-full bg-blue-50 rounded-2xl p-6 pt-8">
                <span className="absolute -top-4 left-6 w-9 h-9 rounded-full bg-blue-700 text-white font-bold flex items-center justify-center shadow">
                  {s.step}
                </span>
                <p className="font-semibold text-blue-900">{s.title}</p>
                <p className="text-sm text-gray-600 mt-1.5">{s.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ===== Dịch vụ ===== */}
      <section id="services" className="bg-white py-16 scroll-mt-24">
        <div className="max-w-6xl mx-auto px-4">
          <FadeIn>
            <h2 className="text-2xl md:text-3xl font-bold text-center text-blue-900">Dịch vụ y tế</h2>
            <p className="text-center text-gray-500 mt-2 mb-10">Chăm sóc sức khỏe toàn diện cho cả gia đình</p>
          </FadeIn>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {SERVICES.map((sv, i) => {
              const inner = (
                <div className="h-full bg-gradient-to-b from-blue-50 to-white border border-blue-100 rounded-2xl overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition">
                  {sv.image && (
                    <Image
                      src={sv.image}
                      alt={sv.title}
                      width={400}
                      height={160}
                      className="w-full h-32 object-cover"
                    />
                  )}
                  <div className="p-6">
                    <div className="w-12 h-12 rounded-xl bg-blue-700 text-white text-2xl flex items-center justify-center mb-4">
                      {sv.icon}
                    </div>
                    <p className="font-semibold text-blue-900">{sv.title}</p>
                    <p className="text-sm text-gray-600 mt-1.5">{sv.desc}</p>
                    {sv.href && <p className="text-sm text-blue-700 font-medium mt-3">Xem ngay →</p>}
                  </div>
                </div>
              );
              return (
                <FadeIn key={sv.title} delay={i * 0.06}>
                  {sv.href ? <Link href={sv.href}>{inner}</Link> : inner}
                </FadeIn>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== Giới thiệu bác sĩ ===== */}
      <section className="max-w-6xl mx-auto px-4 py-16 grid md:grid-cols-2 gap-10 items-center">
        <FadeIn>
          {/* TODO: thay bằng ảnh thật của bác sĩ */}
          <div className="relative mx-auto w-fit">
            <div className="absolute -inset-3 rounded-3xl bg-blue-100 -rotate-2" />
            <Image
              src="/images/consultation.jpg"
              alt="Bác sĩ tư vấn cho bệnh nhân"
              width={460}
              height={310}
              className="relative rounded-3xl shadow-xl object-cover w-115 h-78"
            />
          </div>
        </FadeIn>
        <FadeIn delay={0.1}>
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
        </FadeIn>
      </section>

      {/* ===== Đánh giá bệnh nhân (marquee) ===== */}
      <section className="bg-white py-16">
        <div className="max-w-6xl mx-auto px-4">
          <FadeIn>
            <h2 className="text-2xl md:text-3xl font-bold text-center text-blue-900">
              Bệnh nhân nói gì về chúng tôi
            </h2>
            <p className="text-center text-gray-500 mt-2 mb-10">Sự tin tưởng của bạn là động lực của phòng khám</p>
          </FadeIn>
          <Marquee>
            {TESTIMONIALS.map((t) => (
              <div
                key={t.name}
                className="w-80 shrink-0 bg-blue-50 border border-blue-100 rounded-2xl p-5"
              >
                <p className="text-amber-500 text-sm">★★★★★</p>
                <p className="text-sm text-gray-700 mt-2 leading-relaxed">&ldquo;{t.text}&rdquo;</p>
                <p className="text-sm font-semibold text-blue-900 mt-3">— {t.name}</p>
              </div>
            ))}
          </Marquee>
        </div>
      </section>

      {/* ===== Liên hệ + bản đồ ===== */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4">
          <FadeIn>
            <h2 className="text-2xl md:text-3xl font-bold text-center text-blue-900">
              Liên hệ & chỉ đường
            </h2>
            <p className="text-center text-gray-500 mt-2 mb-10">
              Ghé thăm phòng khám hoặc gọi trước để được hỗ trợ nhanh nhất
            </p>
          </FadeIn>
          <div className="grid md:grid-cols-5 gap-6 items-stretch">
            <FadeIn className="md:col-span-2 space-y-4">
              <div className="bg-white border border-blue-100 rounded-2xl p-5">
                <p className="font-semibold text-blue-900 mb-1">📍 Địa chỉ</p>
                <p className="text-sm text-gray-700">{CLINIC.address}</p>
                <a
                  href={CLINIC.map.directionsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block mt-3 text-sm bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-full"
                >
                  🧭 Chỉ đường trên Google Maps
                </a>
              </div>
              <div className="bg-white border border-blue-100 rounded-2xl p-5">
                <p className="font-semibold text-blue-900 mb-2">🕐 Giờ làm việc</p>
                <ul className="text-sm text-gray-700 space-y-1">
                  {CLINIC.workingHours.map((w) => (
                    <li key={w.days} className="flex justify-between gap-3">
                      <span>{w.days}</span>
                      <span className="text-gray-500">{w.hours}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-white border border-blue-100 rounded-2xl p-5">
                <p className="font-semibold text-blue-900 mb-1">☎ Hotline</p>
                <a href={CLINIC.phoneHref} className="text-xl font-bold text-amber-600 hover:underline">
                  {CLINIC.phone}
                </a>
              </div>
            </FadeIn>
            <FadeIn delay={0.1} className="md:col-span-3">
              <div className="h-full rounded-2xl overflow-hidden border shadow-sm min-h-80">
                <iframe
                  src={CLINIC.map.embedUrl}
                  title={`Bản đồ ${CLINIC.name}`}
                  className="w-full h-full min-h-80"
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </FadeIn>
          </div>
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
              className="shimmer-btn bg-amber-500 hover:bg-amber-600 font-semibold px-6 py-3 rounded-full shadow"
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
