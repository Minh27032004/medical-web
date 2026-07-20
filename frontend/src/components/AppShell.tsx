"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bell,
  Bot,
  ClipboardList,
  FileText,
  HeartPulse,
  LogOut,
  Menu,
  PackagePlus,
  Pill,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { getMe } from "@/lib/me";
import { createSupabaseClient } from "@/lib/supabase";
import type { Me } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  Icon: LucideIcon;
}

const DOCTOR_NAV: NavItem[] = [
  { href: "/patients", label: "Bệnh nhân", Icon: Users },
  { href: "/history", label: "Lịch sử khám", Icon: ClipboardList },
  { href: "/inventory", label: "Kho thuốc", Icon: Pill },
  { href: "/stock-orders", label: "Nhập kho", Icon: PackagePlus },
  { href: "/templates", label: "Thuốc mẫu", Icon: FileText },
  { href: "/chat", label: "Trợ lý", Icon: Bot },
];

const ADMIN_NAV: NavItem[] = [{ href: "/admin/doctors", label: "Quản lý bác sĩ", Icon: ShieldCheck }];

/** Dấu thương hiệu — trái tim nhịp tim, nền brand (dùng chung mọi phòng khám). */
function BrandMark() {
  return (
    <span className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shrink-0 shadow-xs">
      <HeartPulse size={20} strokeWidth={2} className="text-white" />
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
 * Khung app kiểu Untitled UI: sidebar trắng phẳng viền phải + top bar lời chào
 * + vùng nội dung cuộn riêng (full-height, KHÔNG cuộn cả trang).
 * Bỏ qua khung ở /login và /print (in đơn thuốc).
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseClient();
    const load = (has: boolean) => {
      if (has) getMe().then(setMe).catch(() => setMe(null));
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
      {/* Sidebar desktop — trắng phẳng, viền phải (chuẩn app shell Untitled UI) */}
      <aside className="hidden md:flex w-[272px] shrink-0 flex-col bg-white border-r border-gray-200 no-print">
        <SidebarBody me={me} nav={nav} pathname={pathname} onLogout={logout} />
      </aside>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 no-print" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-gray-950/50 backdrop-blur-[2px]" />
          <aside
            className="absolute left-0 top-0 h-full w-72 bg-white shadow-xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <SidebarBody me={me} nav={nav} pathname={pathname} onLogout={logout} />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar desktop — lời chào + chuông + avatar */}
        <header className="hidden md:flex items-center justify-between h-[72px] px-8 shrink-0 border-b border-gray-200 bg-white no-print">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 truncate">
              {greeting()}{displayName ? `, ${displayName}` : ""}
            </h2>
            <p className="text-sm text-gray-500 truncate">
              {me?.clinicName || "Hệ thống quản lý phòng khám"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="w-10 h-10 rounded-lg border border-gray-200 bg-white shadow-xs flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition"
              aria-label="Thông báo"
            >
              <Bell size={18} strokeWidth={1.8} />
            </button>
            <span className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold shrink-0 ring-2 ring-white shadow-xs">
              {initial}
            </span>
          </div>
        </header>

        {/* Header mobile */}
        <header className="md:hidden flex items-center gap-3 h-14 px-4 border-b border-gray-200 bg-white shrink-0 no-print">
          <button
            onClick={() => setMobileOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100"
            aria-label="Mở menu"
          >
            <Menu size={22} strokeWidth={1.8} />
          </button>
          <span className="font-semibold text-gray-900 truncate">
            {me?.clinicName || "Quản lý phòng khám"}
          </span>
        </header>

        <main className="flex-1 overflow-y-auto">
          {/* 7xl (1280px): màn 1080p trở lên không còn chừa hai bên quá rộng, mà dòng chữ
              vẫn đủ ngắn để quét mắt. Full-width sẽ khiến bảng dàn ra khó dò theo hàng. */}
          <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 md:px-8 py-6 md:py-8">{children}</div>
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
      {/* Thương hiệu phòng khám — hàng ngang gọn, chuẩn app shell */}
      <Link href="/" className="flex items-center gap-3 px-5 h-[72px] border-b border-gray-100 shrink-0">
        <BrandMark />
        <span className="min-w-0">
          <span className="block font-semibold text-gray-900 leading-tight truncate">
            {me?.clinicName || "Phòng khám"}
          </span>
          <span className="block text-xs text-gray-500 mt-0.5">Hệ thống nội bộ</span>
        </span>
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {nav.map((n) => {
          const active = pathname.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <n.Icon
                size={20}
                strokeWidth={1.8}
                className={`shrink-0 ${active ? "text-blue-600" : "text-gray-400"}`}
              />
              <span className="truncate">{n.label}</span>
            </Link>
          );
        })}
      </nav>

      {me && (
        <div className="border-t border-gray-200 p-4 shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold shrink-0">
              {initial}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-gray-900 truncate">
                {me.fullName ?? me.username}
              </span>
              <span className="block text-xs text-gray-500">
                {me.role === "ADMIN" ? "Quản trị viên" : "Bác sĩ"}
              </span>
            </span>
            <button
              onClick={onLogout}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
              aria-label="Đăng xuất"
              title="Đăng xuất"
            >
              <LogOut size={18} strokeWidth={1.8} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
