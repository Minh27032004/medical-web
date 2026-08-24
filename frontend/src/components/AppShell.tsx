"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bot,
  ClipboardList,
  FileText,
  HeartPulse,
  LayoutDashboard,
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

/** Một nhóm mục điều hướng; label = null thì không in tiêu đề nhóm. */
interface NavGroup {
  label: string | null;
  items: NavItem[];
}

/**
 * Chia nhóm thay vì một danh sách phẳng 7 mục.
 *
 * Lý do thật là chiều cao: sidebar cao bằng cửa sổ, mà trên màn 1280×720 (Windows 150%)
 * cửa sổ chỉ ~600px — 7 mục phẳng chiếm ~330px nên đáy hụt hơn 100px trống trơn, nhìn
 * rất lệch sau khi nới sidebar lên 320px. Ba tiêu đề nhóm lấp đúng khoảng đó BẰNG THÔNG
 * TIN chứ không phải bằng cách giãn nút ra cho đầy.
 *
 * Thứ tự nhóm theo nhịp làm việc: mở máy xem tổng quan → khám → mới tới chuyện kho.
 */
const DOCTOR_NAV: NavGroup[] = [
  {
    label: "Khám bệnh",
    items: [
      { href: "/dashboard", label: "Tổng quan", Icon: LayoutDashboard },
      { href: "/patients", label: "Bệnh nhân", Icon: Users },
      { href: "/history", label: "Lịch sử khám", Icon: ClipboardList },
    ],
  },
  {
    label: "Kho thuốc",
    items: [
      { href: "/inventory", label: "Kho thuốc", Icon: Pill },
      { href: "/stock-orders", label: "Nhập kho", Icon: PackagePlus },
      { href: "/templates", label: "Thuốc mẫu", Icon: FileText },
    ],
  },
  {
    label: "Công cụ",
    items: [{ href: "/chat", label: "Trợ lý", Icon: Bot }],
  },
];

// Admin chỉ có một mục — gắn tiêu đề nhóm cho một dòng là thừa.
const ADMIN_NAV: NavGroup[] = [
  { label: null, items: [{ href: "/admin/doctors", label: "Quản lý bác sĩ", Icon: ShieldCheck }] },
];

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
      {/* 320px thay cho 272px: trang Tổng quan là màn hình nhiều khối cạnh nhau, sidebar hẹp
          làm cả bố cục lệch về một bên và nhãn dài ("Lịch sử khám", "Quản lý bác sĩ") sát
          mép. Nội dung chính vẫn còn 1120px trên màn 1440 — thừa cho lưới 3 cột. */}
      <aside className="hidden md:flex w-80 shrink-0 flex-col bg-white border-r border-gray-200 no-print">
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
            {/* Nút chuông đã gỡ: nó không có onClick nên người dùng bàn phím Tab vào rồi
                bấm Enter mà không có gì xảy ra, và screen reader vẫn đọc "Thông báo, nút"
                — một lời hứa sai. Dựng lại cùng lúc với tính năng thông báo thật. */}
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
  nav: NavGroup[];
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

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {nav.map((group, gi) => (
          <div key={group.label ?? gi} className={gi > 0 ? "mt-5" : ""}>
            {group.label && (
              <p className="px-3 pb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                {group.label}
              </p>
            )}
            <div className="space-y-1">
              {group.items.map((n) => {
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
            </div>
          </div>
        ))}
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
