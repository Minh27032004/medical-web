"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { createSupabaseClient } from "@/lib/supabase";
import type { Me } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const DOCTOR_NAV: NavItem[] = [
  { href: "/patients", label: "Bệnh nhân", icon: "🧑‍🤝‍🧑" },
  { href: "/history", label: "Lịch sử khám", icon: "📋" },
  { href: "/inventory", label: "Kho thuốc", icon: "💊" },
  { href: "/templates", label: "Thuốc mẫu", icon: "📝" },
  { href: "/chat", label: "Trợ lý", icon: "🩺" },
];

const ADMIN_NAV: NavItem[] = [{ href: "/admin/doctors", label: "Quản lý bác sĩ", icon: "👨‍⚕️" }];

/**
 * Khung app hiện đại: sidebar trái cố định + vùng nội dung cuộn riêng (full-height,
 * KHÔNG cuộn cả trang). Bỏ qua khung ở /login và /print (in đơn thuốc).
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

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

  // Đóng drawer mobile khi đổi trang.
  useEffect(() => setMobileOpen(false), [pathname]);

  if (pathname === "/login" || pathname.startsWith("/print")) {
    return <>{children}</>;
  }

  const nav = me?.role === "ADMIN" ? ADMIN_NAV : me?.role === "DOCTOR" ? DOCTOR_NAV : [];

  async function logout() {
    await createSupabaseClient().auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 text-gray-900">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-gray-200 bg-white no-print">
        <SidebarBody me={me} nav={nav} pathname={pathname} onLogout={logout} />
      </aside>

      {/* Drawer mobile */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 no-print" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <aside
            className="absolute left-0 top-0 h-full w-64 bg-white shadow-xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <SidebarBody me={me} nav={nav} pathname={pathname} onLogout={logout} />
          </aside>
        </div>
      )}

      {/* Cột nội dung */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Thanh trên chỉ hiện ở mobile — nút mở sidebar */}
        <header className="md:hidden flex items-center gap-3 h-14 px-4 border-b border-gray-200 bg-white shrink-0 no-print">
          <button
            onClick={() => setMobileOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 text-xl"
            aria-label="Mở menu"
          >
            ☰
          </button>
          <span className="font-semibold text-blue-900 truncate">
            {me?.clinicName || "Quản lý phòng khám"}
          </span>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

/** Nội dung sidebar dùng chung cho desktop & drawer mobile. */
function SidebarBody({
  me,
  nav,
  pathname,
  onLogout,
}: {
  me: Me | null;
  nav: NavItem[];
  pathname: string;
  onLogout: () => void;
}) {
  const initial = (me?.fullName || me?.username || "?").trim().charAt(0).toUpperCase();
  return (
    <>
      {/* Logo / tên phòng khám */}
      <Link href="/" className="flex items-center gap-3 h-16 px-5 border-b border-gray-100 shrink-0">
        <span className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center text-lg shrink-0">
          ⚕
        </span>
        <span className="min-w-0">
          <span className="block font-semibold text-blue-900 leading-tight truncate">
            {me?.clinicName || "Phòng khám"}
          </span>
          <span className="block text-xs text-gray-400">Hệ thống nội bộ</span>
        </span>
      </Link>

      {/* Điều hướng */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {nav.map((n) => {
          const active = pathname.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-600 hover:bg-blue-50 hover:text-blue-700"
              }`}
            >
              <span className="w-5 text-center text-base leading-none">{n.icon}</span>
              <span className="truncate">{n.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Người dùng + đăng xuất */}
      {me && (
        <div className="border-t border-gray-100 p-3 shrink-0">
          <div className="flex items-center gap-3 px-2 py-2">
            <span className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold shrink-0">
              {initial}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium truncate">{me.fullName ?? me.username}</span>
              <span className="block text-xs text-gray-400">
                {me.role === "ADMIN" ? "Quản trị viên" : "Bác sĩ"}
              </span>
            </span>
          </div>
          <button
            onClick={onLogout}
            className="mt-1 w-full text-left px-2 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50"
          >
            ↪ Đăng xuất
          </button>
        </div>
      )}
    </>
  );
}
