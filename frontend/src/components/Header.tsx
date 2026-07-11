"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createSupabaseClient } from "@/lib/supabase";
import { api } from "@/lib/api";
import { getLocalCart } from "@/lib/cart";
import { CLINIC } from "@/lib/clinic-info";
import NotificationBell from "@/components/NotificationBell";
import type { Profile } from "@/lib/types";

const DOCTOR_MENU = [
  { href: "/doctor/appointments", label: "Lịch hẹn khám" },
  { href: "/doctor/patients", label: "Bệnh nhân" },
  { href: "/doctor/medicines", label: "Kho thuốc" },
  { href: "/doctor/orders", label: "Đơn hàng" },
  { href: "/doctor/chat", label: "Tư vấn bệnh nhân" },
  { href: "/doctor/revenue", label: "Doanh thu" },
  { href: "/doctor/schedule", label: "Lịch làm việc" },
  { href: "/doctor/kb", label: "Dữ liệu chatbot" },
];

export default function Header() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseClient();

    const loadProfile = (hasSession: boolean) => {
      if (hasSession) {
        api<Profile>("/api/me/profile").then(setProfile).catch(() => setProfile(null));
      } else {
        setProfile(null);
      }
    };

    supabase.auth.getSession().then(({ data }) => loadProfile(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) =>
      loadProfile(!!session)
    );

    const updateCart = () =>
      setCartCount(getLocalCart().reduce((sum, i) => sum + i.quantity, 0));
    updateCart();
    window.addEventListener("cart-changed", updateCart);

    return () => {
      sub.subscription.unsubscribe();
      window.removeEventListener("cart-changed", updateCart);
    };
  }, []);

  async function logout() {
    await createSupabaseClient().auth.signOut();
    window.location.href = "/";
  }

  const isDoctor = profile?.role === "DOCTOR";

  return (
    <header className="sticky top-0 z-30 shadow-sm">
      {/* Top bar: hotline + giờ làm việc */}
      <div className="bg-blue-900 text-blue-100 text-xs">
        <div className="max-w-6xl mx-auto px-4 h-8 flex items-center justify-between gap-4">
          <span className="truncate">📍 {CLINIC.address}</span>
          <div className="flex items-center gap-4 shrink-0">
            <span className="hidden sm:inline">🕐 {CLINIC.workingHours[0].days}: {CLINIC.workingHours[0].hours}</span>
            <a href={CLINIC.phoneHref} className="font-semibold text-white hover:text-amber-300">
              ☎ {CLINIC.phone}
            </a>
          </div>
        </div>
      </div>

      {/* Main bar */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <Image
              src="/images/logo.jpg"
              alt="Logo phòng khám"
              width={44}
              height={44}
              className="w-11 h-11 rounded-xl object-cover shadow-sm border border-blue-100"
            />
            <span className="leading-tight">
              <span className="block font-bold text-blue-800">{CLINIC.shortName}</span>
              <span className="block text-[11px] text-gray-500">Tận tâm chăm sóc</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-5 text-sm flex-1 justify-center">
            <Link href="/" className="hover:text-blue-700">Trang chủ</Link>
            <Link href="/medicines" className="hover:text-blue-700">Nhà thuốc</Link>
            {!isDoctor && (
              <>
                <Link href="/#services" className="hover:text-blue-700">Dịch vụ</Link>
                <Link href="/#contact" className="hover:text-blue-700">Liên hệ</Link>
              </>
            )}
            {profile?.role === "PATIENT" && (
              <div className="relative group">
                <button className="hover:text-blue-700 py-2">Hồ sơ của tôi ▾</button>
                <div className="absolute top-full left-0 bg-white border rounded-xl shadow-lg py-2 w-44 hidden group-hover:block">
                  <Link href="/account/appointments" className="block px-4 py-2 hover:bg-blue-50">Lịch hẹn</Link>
                  <Link href="/account/orders" className="block px-4 py-2 hover:bg-blue-50">Đơn hàng</Link>
                  <Link href="/account/prescriptions" className="block px-4 py-2 hover:bg-blue-50">Đơn thuốc</Link>
                </div>
              </div>
            )}
            {isDoctor && (
              <div className="relative group">
                <button className="font-medium text-blue-800 hover:text-blue-600 py-2">
                  🩺 Quản lý phòng khám ▾
                </button>
                <div className="absolute top-full left-0 bg-white border rounded-xl shadow-lg py-2 w-52 hidden group-hover:block">
                  {DOCTOR_MENU.map((m) => (
                    <Link key={m.href} href={m.href} className="block px-4 py-2 hover:bg-blue-50">
                      {m.label}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </nav>

          <div className="flex items-center gap-3 ml-auto text-sm">
            {isDoctor && <NotificationBell />}
            <Link href="/cart" className="relative p-1.5 hover:text-blue-700" title="Giỏ hàng">
              <span className="text-xl">🛒</span>
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-amber-500 text-white rounded-full min-w-4.5 h-4.5 px-1 text-[10px] flex items-center justify-center font-bold">
                  {cartCount}
                </span>
              )}
            </Link>
            {profile ? (
              <>
                <span className="hidden sm:inline text-gray-600 max-w-28 truncate">
                  {profile.fullName ?? (isDoctor ? "Bác sĩ" : "Bệnh nhân")}
                </span>
                <button onClick={logout} className="text-gray-500 hover:text-red-600" title="Đăng xuất">
                  Thoát
                </button>
              </>
            ) : (
              <Link href="/login" className="text-blue-700 hover:underline shrink-0">
                Đăng nhập
              </Link>
            )}
            {!isDoctor && (
              <Link
                href="/booking"
                className="hidden sm:inline-block bg-amber-500 hover:bg-amber-600 text-white font-medium px-4 py-2 rounded-full shadow-sm shrink-0"
              >
                Đặt lịch ngay
              </Link>
            )}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden text-2xl leading-none p-1"
              aria-label="Menu"
            >
              ☰
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <nav className="md:hidden border-t px-4 py-3 space-y-1 text-sm bg-white">
            {[
              { href: "/", label: "Trang chủ" },
              { href: "/medicines", label: "Nhà thuốc" },
              ...(!isDoctor ? [{ href: "/booking", label: "Đặt lịch khám" }] : []),
              ...(profile?.role === "PATIENT"
                ? [
                    { href: "/account/appointments", label: "Lịch hẹn của tôi" },
                    { href: "/account/orders", label: "Đơn hàng của tôi" },
                    { href: "/account/prescriptions", label: "Đơn thuốc của tôi" },
                  ]
                : []),
              ...(isDoctor ? DOCTOR_MENU : []),
            ].map((m) => (
              <Link
                key={m.href}
                href={m.href}
                onClick={() => setMobileOpen(false)}
                className="block py-2 px-2 rounded-lg hover:bg-blue-50"
              >
                {m.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
