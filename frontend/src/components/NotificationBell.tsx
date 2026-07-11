"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface NotiItem {
  id: string;
  type: "NEW_APPOINTMENT" | "NEW_ORDER" | "CHAT_WAITING";
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

interface Feed {
  unreadCount: number;
  items: NotiItem[];
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.floor(hours / 24)} ngày trước`;
}

/** Chuông thông báo cho bác sĩ: lịch hẹn mới, đơn hàng mới, bệnh nhân chờ tư vấn. */
export default function NotificationBell() {
  const router = useRouter();
  const [feed, setFeed] = useState<Feed | null>(null);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    api<Feed>("/api/doctor/notifications").then(setFeed).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000); // poll 30s
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function clickItem(n: NotiItem) {
    if (!n.readAt) {
      await api(`/api/doctor/notifications/${n.id}/read`, { method: "POST" }).catch(() => {});
    }
    setOpen(false);
    load();
    if (n.link) router.push(n.link);
  }

  async function readAll() {
    await api("/api/doctor/notifications/read-all", { method: "POST" }).catch(() => {});
    load();
  }

  const unread = feed?.unreadCount ?? 0;

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-1.5 text-xl hover:text-blue-700"
        title="Thông báo"
        aria-label="Thông báo"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-1 bg-red-600 text-white rounded-full min-w-4.5 h-4.5 px-1 text-[10px] font-bold flex items-center justify-center animate-pulse">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border rounded-2xl shadow-xl overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-2.5 border-b bg-blue-50">
            <span className="font-semibold text-sm text-blue-900">Thông báo</span>
            {unread > 0 && (
              <button onClick={readAll} className="text-xs text-blue-700 hover:underline">
                Đánh dấu đã đọc hết
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto divide-y">
            {(!feed || feed.items.length === 0) && (
              <p className="text-sm text-gray-500 text-center py-8">Chưa có thông báo nào.</p>
            )}
            {feed?.items.map((n) => (
              <button
                key={n.id}
                onClick={() => clickItem(n)}
                className={`w-full text-left px-4 py-3 hover:bg-blue-50 ${
                  n.readAt ? "opacity-60" : "bg-blue-50/40"
                }`}
              >
                <div className="flex items-start gap-2">
                  {!n.readAt && <span className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 shrink-0" />}
                  <div className={n.readAt ? "pl-4" : ""}>
                    <p className="text-sm font-medium leading-snug">{n.title}</p>
                    {n.body && <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{n.body}</p>}
                    <p className="text-[11px] text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
