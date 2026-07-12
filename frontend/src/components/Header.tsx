"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { createSupabaseClient } from "@/lib/supabase";
import type { Me } from "@/lib/types";

const DOCTOR_NAV = [
  { href: "/patients", label: "Bệnh nhân" },
  { href: "/history", label: "Lịch sử khám" },
  { href: "/inventory", label: "Kho thuốc" },
  { href: "/templates", label: "Thuốc mẫu" },
];

const ADMIN_NAV = [{ href: "/admin/doctors", label: "Quản lý bác sĩ" }];

export default function Header() {
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    const supabase = createSupabaseClient();
    const load = (has: boolean) => {
      if (has) api<Me>("/api/me/profile").then(setMe).catch(() => setMe(null));
      else setMe(null);
    };
    supabase.auth.getSession().then(({ data }) => load(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => load(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function logout() {
    await createSupabaseClient().auth.signOut();
    window.location.href = "/login";
  }

  if (pathname === "/login" || pathname.startsWith("/print")) return null;

  const nav = me?.role === "ADMIN" ? ADMIN_NAV : me?.role === "DOCTOR" ? DOCTOR_NAV : [];

  return (
    <header className="sticky top-0 z-30 bg-white border-b shadow-sm no-print">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-5">
        <Link href="/" className="font-bold text-blue-800 shrink-0">
          ⚕ {me?.clinicName || "Quản lý phòng khám"}
        </Link>
        <nav className="flex items-center gap-1 text-sm flex-1 overflow-x-auto">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap ${
                pathname.startsWith(n.href)
                  ? "bg-blue-600 text-white"
                  : "hover:bg-blue-50 text-gray-700"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        {me && (
          <div className="flex items-center gap-3 text-sm shrink-0">
            <span className="text-gray-600 hidden sm:inline">
              {me.fullName ?? me.username}
              {me.role === "ADMIN" && " (Admin)"}
            </span>
            <button onClick={logout} className="text-red-600 hover:underline">
              Đăng xuất
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
