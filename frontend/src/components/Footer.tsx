import Image from "next/image";
import Link from "next/link";
import { CLINIC } from "@/lib/clinic-info";

export default function Footer() {
  return (
    <footer id="contact" className="bg-blue-950 text-blue-100 mt-12">
      <div className="max-w-6xl mx-auto px-4 py-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 text-sm">
        <div>
          <div className="flex items-center gap-2.5 mb-3">
            <Image
              src="/images/logo.jpg"
              alt="Logo phòng khám"
              width={40}
              height={40}
              className="w-10 h-10 rounded-xl object-cover"
            />
            <span className="font-bold text-white">{CLINIC.name}</span>
          </div>
          <p className="text-blue-300 leading-relaxed">{CLINIC.slogan}</p>
          <p className="mt-2 text-blue-300">
            {CLINIC.doctor.name} — {CLINIC.doctor.title}
          </p>
        </div>

        <div>
          <p className="font-semibold text-white mb-3">Giờ làm việc</p>
          <ul className="space-y-1.5 text-blue-200">
            {CLINIC.workingHours.map((w) => (
              <li key={w.days} className="flex justify-between gap-3">
                <span>{w.days}</span>
                <span className="text-blue-300">{w.hours}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="font-semibold text-white mb-3">Liên kết nhanh</p>
          <ul className="space-y-1.5">
            <li><Link href="/booking" className="hover:text-white">Đặt lịch khám</Link></li>
            <li><Link href="/medicines" className="hover:text-white">Nhà thuốc</Link></li>
            <li><Link href="/chat" className="hover:text-white">Tư vấn trực tuyến</Link></li>
            <li><Link href="/register" className="hover:text-white">Đăng ký tài khoản</Link></li>
          </ul>
        </div>

        <div>
          <p className="font-semibold text-white mb-3">Liên hệ</p>
          <ul className="space-y-1.5 text-blue-200">
            <li>📍 {CLINIC.address}</li>
            <li>
              ☎ <a href={CLINIC.phoneHref} className="text-amber-400 font-semibold hover:underline">{CLINIC.phone}</a>
            </li>
            <li>✉ {CLINIC.email}</li>
            <li>
              <a href={CLINIC.map.directionsUrl} target="_blank" rel="noreferrer" className="hover:text-white">
                🧭 Xem bản đồ & chỉ đường
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 text-center text-xs text-blue-400 py-4">
        © {new Date().getFullYear()} {CLINIC.name}. Thông tin trên website chỉ mang tính tham khảo,
        không thay thế cho chẩn đoán của bác sĩ.
      </div>
    </footer>
  );
}
