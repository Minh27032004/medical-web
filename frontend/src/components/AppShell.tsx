"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { createSupabaseClient } from "@/lib/supabase";
import type { Me } from "@/lib/types";

/* ===== Icon line (stroke) — sắc nét, đồng bộ, dùng currentColor để active đổi màu ===== */
function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className="shrink-0"
    >
      {children}
    </svg>
  );
}
const IconUsers = () => (
  <Svg><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></Svg>
);
const IconHistory = () => (
  <Svg><rect width="8" height="4" x="8" y="2" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="M12 11h4" /><path d="M12 16h4" /><path d="M8 11h.01" /><path d="M8 16h.01" /></Svg>
);
const IconPill = () => (
  <Svg><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" /><path d="m8.5 8.5 7 7" /></Svg>
);
const IconTemplate = () => (
  <Svg><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" /></Svg>
);
const IconAssistant = () => (
  <Svg><path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" /></Svg>
);
const IconAdmin = () => (
  <Svg><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></Svg>
);

interface NavItem {
  href: string;
  label: string;
  Icon: () => React.ReactElement;
}

const DOCTOR_NAV: NavItem[] = [
  { href: "/patients", label: "Bệnh nhân", Icon: IconUsers },
  { href: "/history", label: "Lịch sử khám", Icon: IconHistory },
  { href: "/inventory", label: "Kho thuốc", Icon: IconPill },
  { href: "/templates", label: "Thuốc mẫu", Icon: IconTemplate },
  { href: "/chat", label: "Trợ lý", Icon: IconAssistant },
];

const ADMIN_NAV: NavItem[] = [{ href: "/admin/doctors", label: "Quản lý bác sĩ", Icon: IconAdmin }];

/** Dấu thương hiệu — trái tim + chữ thập, gradient theo logo phòng khám (dùng chung mọi phòng khám). */
function BrandMark() {
  return (
    <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-teal-500 flex items-center justify-center shrink-0 shadow-sm">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" />
        <path d="M12 8.5v4M10 10.5h4" />
      </svg>
    </span>
  );
}

/** Lời chào theo giờ trong ngày (top bar). */
function greeting() {
  const h = new Date().getHours();
  if (h < 11) return "Chào buổi sáng";
  if (h < 13) return "Chào buổi trưa";
  if (h < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

/**
 * Khung app hiện đại (template Figma Healthcare dashboard): sidebar nổi bo góc bên trái
 * + top bar lời chào + vùng nội dung cuộn riêng (full-height, KHÔNG cuộn cả trang).
 * Bỏ qua khung ở /login và /print (in đơn thuốc).
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

  useEffect(() => setMobileOpen(false), [pathname]);

  if (pathname === "/login" || pathname.startsWith("/print")) {
    return <>{children}</>;
  }

  const nav = me?.role === "ADMIN" ? ADMIN_NAV : me?.role === "DOCTOR" ? DOCTOR_NAV : [];
  const displayName = me?.fullName ?? me?.username ?? "";
  const initial = (me?.fullName || me?.username || "?").trim().charAt(0).toUpperCase();

  async function logout() {
    await createSupabaseClient().auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="flex h-screen overflow-hidden text-gray-900">
      {/* Sidebar nổi — thẻ trắng bo góc lớn, cách mép (desktop) */}
      <aside className="hidden md:flex w-[264px] shrink-0 py-4 pl-4 no-print">
        <div className="card flex flex-col w-full overflow-hidden">
          <SidebarBody me={me} nav={nav} pathname={pathname} onLogout={logout} />
        </div>
      </aside>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 no-print" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <aside className="absolute left-0 top-0 h-full w-72 bg-white shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <SidebarBody me={me} nav={nav} pathname={pathname} onLogout={logout} />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar desktop — lời chào + chuông + avatar (kiểu Figma) */}
        <header className="hidden md:flex items-center justify-between h-20 px-8 shrink-0 no-print">
          <div className="min-w-0">
            <p className="text-xs text-gray-400">{greeting()},</p>
            <h2 className="text-xl font-bold text-[#1b2559] truncate">
              {displayName || me?.clinicName || "Quản lý phòng khám"} 👋
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button className="w-10 h-10 rounded-full bg-white border border-gray-100 flex items-center justify-center text-gray-500 hover:text-blue-600 hover:border-blue-200 transition" aria-label="Thông báo" style={{ boxShadow: "var(--shadow-card)" }}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
            </button>
            <span className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-500 to-teal-500 text-white flex items-center justify-center font-semibold shrink-0">
              {initial}
            </span>
          </div>
        </header>

        {/* Header mobile */}
        <header className="md:hidden flex items-center gap-3 h-14 px-4 border-b border-gray-100 bg-white shrink-0 no-print">
          <button onClick={() => setMobileOpen(true)} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100" aria-label="Mở menu">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <span className="font-semibold text-blue-900 truncate">{me?.clinicName || "Quản lý phòng khám"}</span>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 md:px-8 py-6 md:pt-2">{children}</div>
        </main>
      </div>
    </div>
  );
}

function SidebarBody({
  me, nav, pathname, onLogout,
}: {
  me: Me | null;
  nav: NavItem[];
  pathname: string;
  onLogout: () => void;
}) {
  const initial = (me?.fullName || me?.username || "?").trim().charAt(0).toUpperCase();
  return (
    <>
      {/* Khối thương hiệu phòng khám — trên cùng, căn giữa kiểu Figma */}
      <Link href="/" className="flex flex-col items-center gap-2.5 px-4 pt-7 pb-5 shrink-0">
        <BrandMark />
        <span className="text-center min-w-0 max-w-full">
          <span className="block font-bold text-[#1b2559] leading-tight truncate">
            {me?.clinicName || "Phòng khám"}
          </span>
          <span className="block text-xs text-gray-400 mt-0.5">Hệ thống nội bộ</span>
        </span>
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
        {nav.map((n) => {
          const active = pathname.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                active ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-blue-50 hover:text-blue-700"
              }`}
              style={active ? { boxShadow: "0 8px 18px rgba(51,119,221,0.28)" } : undefined}
            >
              <n.Icon />
              <span className="truncate">{n.label}</span>
            </Link>
          );
        })}
      </nav>

      {me && (
        <div className="border-t border-gray-100 p-3 shrink-0">
          <div className="flex items-center gap-3 px-2 py-2">
            <span className="w-9 h-9 rounded-full bg-gradient-to-br from-sky-500 to-teal-500 text-white flex items-center justify-center font-semibold shrink-0">
              {initial}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-[#1b2559] truncate">{me.fullName ?? me.username}</span>
              <span className="block text-xs text-gray-400">{me.role === "ADMIN" ? "Quản trị viên" : "Bác sĩ"}</span>
            </span>
          </div>
          <button onClick={onLogout} className="mt-1 w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></svg>
            Đăng xuất
          </button>
        </div>
      )}
    </>
  );
}
