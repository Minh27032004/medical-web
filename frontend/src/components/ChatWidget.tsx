"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { formatChatHtml } from "@/lib/chat-format";
import { createSupabaseClient } from "@/lib/supabase";
import type { Profile } from "@/lib/types";

interface ChatMessage {
  id: string;
  sender: "USER" | "AI" | "DOCTOR";
  content: string;
  createdAt: string;
}

interface ChatState {
  conversationId: string | null;
  status: "AI" | "WAITING_DOCTOR" | "WITH_DOCTOR" | "CLOSED";
  messages: ChatMessage[];
}

function getAnonKey(): string {
  let key = localStorage.getItem("chat_anon_key");
  if (!key) {
    key = crypto.randomUUID();
    localStorage.setItem("chat_anon_key", key);
  }
  return key;
}

/** Câu hỏi nhanh theo vai trò — label hiển thị, message là câu gửi thật sự. */
const CUSTOMER_QUICK = [
  { label: "🕐 Thời gian làm việc", message: "Phòng khám làm việc giờ nào?" },
  { label: "👨‍⚕️ Thông tin bác sĩ", message: "Cho tôi thông tin về bác sĩ của phòng khám" },
  { label: "💬 Nhắn tin trực tiếp", action: "meet-doctor" as const },
];

const PATIENT_QUICK = [
  { label: "📋 Tra cứu lịch sử khám bệnh", message: "Cho tôi xem lịch sử khám bệnh của tôi" },
  { label: "💊 Tra cứu đơn thuốc", message: "Cho tôi xem đơn thuốc của tôi" },
  { label: "💬 Nhắn tin trực tiếp", action: "meet-doctor" as const },
];

const STATUS_NOTICE: Record<string, string> = {
  WAITING_DOCTOR: "⏳ Đã chuyển cho bác sĩ — vui lòng chờ trả lời",
  WITH_DOCTOR: "👨‍⚕️ Bạn đang chat trực tiếp với bác sĩ",
};

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [state, setState] = useState<ChatState | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const s = await api<ChatState>(`/api/chat?anonKey=${getAnonKey()}`);
      setState(s);
    } catch {
      /* giữ state cũ khi poll lỗi */
    }
  }, []);

  // Nhận diện vai trò (Customer / Patient / Doctor)
  useEffect(() => {
    const supabase = createSupabaseClient();
    const loadProfile = (has: boolean) => {
      if (has) api<Profile>("/api/me/profile").then(setProfile).catch(() => setProfile(null));
      else setProfile(null);
    };
    supabase.auth.getSession().then(({ data }) => loadProfile(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => loadProfile(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  // Poll 5s khi mở popup và đang chờ/chat với bác sĩ
  useEffect(() => {
    if (!open || !state || state.status === "AI" || state.status === "CLOSED") return;
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [open, state, load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state?.messages.length, open]);

  async function sendText(content: string) {
    if (!content.trim() || sending) return;
    setSending(true);
    setError("");
    setInput("");
    setState((s) =>
      s
        ? {
            ...s,
            messages: [
              ...s.messages,
              {
                id: `tmp-${Date.now()}`,
                sender: "USER",
                content,
                createdAt: new Date().toISOString(),
              },
            ],
          }
        : s
    );
    try {
      const s = await api<ChatState>("/api/chat/messages", {
        method: "POST",
        body: JSON.stringify({ content, anonKey: getAnonKey() }),
      });
      setState(s);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gửi thất bại, thử lại");
    } finally {
      setSending(false);
    }
  }

  async function meetDoctor() {
    if (!profile) {
      // Customer: phải đăng nhập thành Patient mới nhắn trực tiếp với bác sĩ
      window.location.href = "/login?next=" + encodeURIComponent(window.location.pathname);
      return;
    }
    try {
      const s = await api<ChatState>("/api/chat/meet-doctor", { method: "POST" });
      setState(s);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không gửi được yêu cầu");
    }
  }

  // Doctor không cần widget tư vấn (họ có inbox riêng)
  if (profile?.role === "DOCTOR") return null;

  const quickReplies = profile ? PATIENT_QUICK : CUSTOMER_QUICK;
  const showQuick = !state || state.status === "AI" || state.status === "CLOSED";

  return (
    <>
      {/* Nút mascot nổi góc phải dưới */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 group"
          aria-label="Mở tư vấn"
        >
          <span className="absolute -top-9 right-0 bg-white border border-blue-200 text-blue-800 text-xs font-medium px-3 py-1.5 rounded-full shadow-md whitespace-nowrap group-hover:bg-blue-50">
            Tư vấn miễn phí 💬
          </span>
          <span className="block w-16 h-16 rounded-full bg-white shadow-xl border-2 border-blue-200 overflow-hidden hover:scale-105 transition-transform animate-blob">
            <Image
              src="/images/chat-mascot.png"
              alt="Trợ lý phòng khám"
              width={64}
              height={64}
              className="w-full h-full object-contain scale-125"
            />
          </span>
          <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full" />
        </button>
      )}

      {/* Popup chat */}
      {open && (
        <div className="fixed bottom-5 right-5 z-40 w-[92vw] max-w-sm h-[70vh] max-h-[560px] bg-white rounded-2xl shadow-2xl border flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-700 to-blue-500 text-white px-4 py-3 flex items-center gap-3 shrink-0">
            <span className="w-10 h-10 rounded-full bg-white/90 overflow-hidden shrink-0">
              <Image
                src="/images/chat-mascot.png"
                alt=""
                width={40}
                height={40}
                className="w-full h-full object-contain scale-125"
              />
            </span>
            <div className="flex-1 leading-tight">
              <p className="font-bold text-sm">Trợ lý Phòng Khám Gia Đình</p>
              <p className="text-[11px] text-blue-100">
                {state && STATUS_NOTICE[state.status]
                  ? STATUS_NOTICE[state.status]
                  : "Trực tuyến — hỏi gì cũng được 😊"}
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-white/80 hover:text-white text-xl leading-none p-1"
              aria-label="Đóng"
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-gradient-to-b from-blue-50/60 to-white">
            {(!state || state.messages.length === 0) && (
              <div className="text-center text-gray-500 text-xs py-6 space-y-1.5">
                <p className="text-2xl">👋</p>
                <p>
                  Xin chào! Tôi là trợ lý của phòng khám.
                  <br />
                  Chọn câu hỏi nhanh bên dưới hoặc nhập câu hỏi.
                </p>
                <p className="text-[10px] text-gray-400">
                  Trợ lý AI không chẩn đoán bệnh — câu hỏi sức khỏe sẽ chuyển tới bác sĩ.
                </p>
              </div>
            )}
            {state?.messages.map((m) => (
              <div key={m.id} className={m.sender === "USER" ? "flex justify-end" : "flex justify-start"}>
                {m.sender !== "USER" && (
                  <span className="w-7 h-7 rounded-full bg-blue-100 overflow-hidden shrink-0 mr-1.5 mt-0.5">
                    {m.sender === "AI" ? (
                      <Image
                        src="/images/chat-mascot.png"
                        alt=""
                        width={28}
                        height={28}
                        className="w-full h-full object-contain scale-125"
                      />
                    ) : (
                      <span className="w-full h-full flex items-center justify-center text-sm">👨‍⚕️</span>
                    )}
                  </span>
                )}
                <div
                  className={
                    m.sender === "USER"
                      ? "bg-blue-600 text-white rounded-2xl rounded-br-md px-3.5 py-2 max-w-[80%] text-[13px] shadow-sm"
                      : m.sender === "DOCTOR"
                        ? "bg-white border-l-4 border-blue-500 border rounded-2xl rounded-bl-md px-3.5 py-2 max-w-[82%] text-[13px] shadow-sm"
                        : "bg-white border rounded-2xl rounded-bl-md px-3.5 py-2 max-w-[82%] text-[13px] shadow-sm"
                  }
                >
                  {m.sender === "DOCTOR" && (
                    <p className="text-[10px] font-semibold text-blue-700 mb-0.5">👨‍⚕️ Bác sĩ trả lời</p>
                  )}
                  {m.sender === "USER" ? (
                    <span className="whitespace-pre-line">{m.content}</span>
                  ) : (
                    <div
                      className="chat-md"
                      dangerouslySetInnerHTML={{ __html: formatChatHtml(m.content) }}
                    />
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex items-center gap-1.5 text-gray-400 text-xs pl-9">
                <span className="animate-bounce">●</span>
                <span className="animate-bounce [animation-delay:120ms]">●</span>
                <span className="animate-bounce [animation-delay:240ms]">●</span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick replies */}
          {showQuick && !sending && (
            <div className="px-3 pb-2 flex flex-wrap gap-1.5 shrink-0 bg-white">
              {quickReplies.map((q) => (
                <button
                  key={q.label}
                  onClick={() => ("action" in q && q.action === "meet-doctor" ? meetDoctor() : sendText(q.message!))}
                  className="text-[12px] border border-blue-300 text-blue-700 rounded-full px-3 py-1.5 hover:bg-blue-50 transition-colors"
                >
                  {q.label}
                </button>
              ))}
            </div>
          )}

          {error && <p className="text-red-600 text-xs px-3 pb-1 bg-white">{error}</p>}

          {/* Input */}
          <div className="flex gap-2 p-2.5 border-t bg-white shrink-0">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendText(input)}
              placeholder="Nhập câu hỏi..."
              className="flex-1 border rounded-full px-4 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-300"
              disabled={sending}
            />
            <button
              onClick={() => sendText(input)}
              disabled={sending || !input.trim()}
              className="bg-blue-600 text-white w-9 h-9 rounded-full hover:bg-blue-700 disabled:opacity-40 shrink-0 flex items-center justify-center"
              aria-label="Gửi"
            >
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  );
}
