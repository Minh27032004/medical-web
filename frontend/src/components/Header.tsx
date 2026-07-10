"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createSupabaseClient } from "@/lib/supabase";
import { api } from "@/lib/api";
import { getLocalCart } from "@/lib/cart";
import type { Profile } from "@/lib/types";

export default function Header() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [cartCount, setCartCount] = useState(0);

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

  return (
    <header className="border-b bg-white sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-6">
        <Link href="/" className="font-bold text-emerald-700 text-lg">
          🏥 Phòng khám
        </Link>
        <nav className="flex items-center gap-4 text-sm flex-1">
          <Link href="/medicines" className="hover:text-emerald-700">
            Cửa hàng thuốc
          </Link>
          <Link href="/cart" className="hover:text-emerald-700">
            Giỏ hàng{cartCount > 0 && (
              <span className="ml-1 bg-emerald-600 text-white rounded-full px-1.5 text-xs">
                {cartCount}
              </span>
            )}
          </Link>
          {profile?.role !== "DOCTOR" && (
            <Link href="/booking" className="hover:text-emerald-700">
              Đặt lịch khám
            </Link>
          )}
          {profile?.role === "PATIENT" && (
            <>
              <Link href="/account/appointments" className="hover:text-emerald-700">
                Lịch hẹn
              </Link>
              <Link href="/account/orders" className="hover:text-emerald-700">
                Đơn hàng
              </Link>
              <Link href="/account/prescriptions" className="hover:text-emerald-700">
                Đơn thuốc
              </Link>
            </>
          )}
          {profile?.role === "DOCTOR" && (
            <>
              <Link href="/doctor/appointments" className="hover:text-emerald-700 font-medium">
                Lịch hẹn
              </Link>
              <Link href="/doctor/patients" className="hover:text-emerald-700 font-medium">
                Bệnh nhân
              </Link>
              <Link href="/doctor/medicines" className="hover:text-emerald-700 font-medium">
                Kho thuốc
              </Link>
              <Link href="/doctor/orders" className="hover:text-emerald-700 font-medium">
                Đơn hàng
              </Link>
              <Link href="/doctor/schedule" className="hover:text-emerald-700 font-medium">
                Lịch làm việc
              </Link>
              <Link href="/doctor/revenue" className="hover:text-emerald-700 font-medium">
                Doanh thu
              </Link>
            </>
          )}
        </nav>
        <div className="text-sm flex items-center gap-3">
          {profile ? (
            <>
              <span className="text-gray-600">
                {profile.fullName ?? (profile.role === "DOCTOR" ? "Bác sĩ" : "Bệnh nhân")}
              </span>
              <button onClick={logout} className="text-red-600 hover:underline">
                Đăng xuất
              </button>
            </>
          ) : (
            <Link href="/login" className="text-emerald-700 hover:underline">
              Đăng nhập
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
