"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getMe } from "@/lib/me";
import { createSupabaseClient } from "@/lib/supabase";
import type { Me } from "@/lib/types";
import AssistantChat from "./AssistantChat";
import { IconX } from "./ui";

const BTN = 64;
const PANEL_W = 360;
const PANEL_H = 520;

type Pos = { x: number; y: number };

/** Trợ lý nổi, KÉO-THẢ được — bác sĩ hỏi đáp về dữ liệu của mình (dùng chung lõi với /chat). */
export default function AssistantWidget() {
  const pathname = usePathname();
  const [role, setRole] = useState<Me["role"] | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseClient();
    const load = (has: boolean) => {
      if (has) getMe().then((m) => setRole(m.role)).catch(() => setRole(null));
      else setRole(null);
    };
    supabase.auth.getSession().then(({ data }) => load(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => load(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Vị trí mặc định: góc phải-dưới (đặt 1 lần sau khi mount, phía client).
  useEffect(() => {
    setPos({ x: window.innerWidth - BTN - 20, y: window.innerHeight - BTN - 20 });
  }, []);

  // Khi đổi kích thước cửa sổ / zoom: kéo nút về trong màn hình để KHÔNG bao giờ bị khuất.
  useEffect(() => {
    const clamp = () =>
      setPos((p) =>
        p
          ? {
              x: Math.max(8, Math.min(p.x, window.innerWidth - BTN - 8)),
              y: Math.max(8, Math.min(p.y, window.innerHeight - BTN - 8)),
            }
          : p
      );
    window.addEventListener("resize", clamp);
    return () => window.removeEventListener("resize", clamp);
  }, []);

  if (role !== "DOCTOR" || pathname === "/login" || pathname === "/chat" || pathname.startsWith("/print")) {
    return null;
  }

  function onPointerDown(e: React.PointerEvent) {
    const startX = e.clientX;
    const startY = e.clientY;
    const base = pos ?? { x: window.innerWidth - BTN - 20, y: window.innerHeight - BTN - 20 };
    let moved = false;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) { moved = true; setDragging(true); }
      const x = Math.max(8, Math.min(base.x + dx, window.innerWidth - BTN - 8));
      const y = Math.max(8, Math.min(base.y + dy, window.innerHeight - BTN - 8));
      setPos({ x, y });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDragging(false);
      if (!moved) setOpen((o) => !o); // không kéo → coi như bấm mở/đóng
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  // Panel bám theo nút: ưu tiên phía trên, hết chỗ thì xuống dưới; luôn nằm gọn trong màn hình.
  const panelStyle = (): React.CSSProperties => {
    if (!pos || typeof window === "undefined") return { right: 16, bottom: 96 };
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.min(PANEL_W, vw - 24);
    const h = Math.min(PANEL_H, vh - 24);
    let top = pos.y - h - 12;
    if (top < 12) top = pos.y + BTN + 12;
    let left = pos.x + BTN - w;
    left = Math.max(12, Math.min(left, vw - w - 12));
    top = Math.max(12, Math.min(top, vh - h - 12));
    return { left, top, width: w, height: h };
  };

  return (
    <>
      {open && (
        <div
          className="fixed z-40 bg-white border border-gray-200 rounded-2xl shadow-xl flex flex-col no-print"
          style={panelStyle()}
        >
          <div className="flex items-center justify-between px-4 py-2.5 bg-blue-600 text-white rounded-t-2xl">
            <span className="font-medium text-sm">Trợ lý</span>
            <button
              onClick={() => setOpen(false)}
              className="hover:bg-white/20 rounded w-6 h-6 flex items-center justify-center"
              aria-label="Đóng"
            >
              <IconX size={15} />
            </button>
          </div>
          <div className="flex-1 min-h-0 p-3">
            <AssistantChat />
          </div>
        </div>
      )}

      <button
        onPointerDown={onPointerDown}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((o) => !o); } }}
        className={`fixed z-40 w-16 h-16 rounded-full bg-white shadow-xl ring-2 ring-blue-400 hover:ring-blue-500 no-print select-none ${
          pos ? "" : "bottom-5 right-5"
        } ${dragging ? "cursor-grabbing scale-105" : "cursor-grab"}`}
        style={pos ? { left: pos.x, top: pos.y, touchAction: "none" } : { touchAction: "none" }}
        title="Trợ lý — bấm để mở, kéo để di chuyển"
        aria-label={open ? "Đóng trợ lý" : "Mở trợ lý"}
      >
        <span className="absolute inset-0 rounded-full overflow-hidden">
          <Image
            src="/images/assistant.png"
            alt="Trợ lý"
            fill
            sizes="64px"
            draggable={false}
            className="object-contain p-1 pointer-events-none"
          />
        </span>
        <span className="absolute -top-1 -right-1 px-1 h-4 min-w-[16px] rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white pointer-events-none">
          AI
        </span>
      </button>
    </>
  );
}
