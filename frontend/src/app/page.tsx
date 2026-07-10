import Link from "next/link";

export default function Home() {
  return (
    <div className="py-12 text-center space-y-6">
      <h1 className="text-3xl font-bold text-emerald-700">
        Phòng khám gia đình
      </h1>
      <p className="text-gray-600 max-w-xl mx-auto">
        Đặt lịch khám bệnh, mua thuốc và nhận tư vấn sức khỏe trực tuyến.
        Nhận thuốc trực tiếp tại phòng khám.
      </p>
      <div className="flex justify-center gap-4">
        <Link
          href="/medicines"
          className="bg-emerald-600 text-white px-5 py-2.5 rounded-lg hover:bg-emerald-700"
        >
          Xem cửa hàng thuốc
        </Link>
        <Link
          href="/booking"
          className="border border-emerald-600 text-emerald-700 px-5 py-2.5 rounded-lg hover:bg-emerald-50"
        >
          Đặt lịch khám
        </Link>
      </div>
    </div>
  );
}
