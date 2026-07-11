"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { formatChatHtml } from "@/lib/chat-format";
import { createSupabaseClient } from "@/lib/supabase";

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

const STATUS_NOTICE: Record<string, string> = {
  WAITING_DOCTOR: "⏳ Đã chuyển cho bác sĩ — vui lòng chờ trả lời",
  WITH_DOCTOR: "👨‍⚕️ Bạn đang chat trực tiếp với bác sĩ",
};

export default function ChatPage() {
  const [state, setState] = useState<ChatState | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
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

  useEffect(() => {
    createSupabaseClient()
      .auth.getSession()
      .then(({ data }) => setLoggedIn(!!data.session));
    load();
  }, [load]);

  // Poll 5s khi chờ/đang chat với bác sĩ
  useEffect(() => {
    if (!state || state.status === "AI" || state.status === "CLOSED") return;
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [state, load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state?.messages.length]);

  async function send() {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    setError("");
    setInput("");
    // hiển thị tin nhắn của mình ngay, chờ AI trả lời
    setState((s) =>
      s
        ? {
            ...s,
            messages: [
              ...s.messages,
              { id: `tmp-${Date.now()}`, sender: "USER", content, createdAt: new Date().toISOString() },
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
    try {
      const s = await api<ChatState>("/api/chat/meet-doctor", { method: "POST" });
      setState(s);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không gửi được yêu cầu");
    }
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col" style={{ height: "calc(100vh - 8rem)" }}>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-bold">Tư vấn</h1>
        {loggedIn && state?.status === "AI" && (
          <button
            onClick={meetDoctor}
            className="text-sm border border-blue-600 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-50"
          >
            👨‍⚕️ Gặp bác sĩ
          </button>
        )}
      </div>

      {state && STATUS_NOTICE[state.status] && (
        <p className="text-sm bg-blue-50 text-blue-700 rounded-lg px-3 py-2 mb-3">
          {STATUS_NOTICE[state.status]}
        </p>
      )}

      <div className="flex-1 overflow-y-auto bg-white border rounded-xl p-4 space-y-3">
        {(!state || state.messages.length === 0) && (
          <div className="text-center text-gray-500 text-sm py-8 space-y-2">
            <p className="text-3xl">💬</p>
            <p>Xin chào! Tôi có thể trả lời về phòng khám, giờ làm việc, dịch vụ, thuốc...</p>
            <p className="text-xs">
              Lưu ý: trợ lý AI không chẩn đoán bệnh — câu hỏi sức khỏe sẽ được chuyển tới bác sĩ.
            </p>
          </div>
        )}
        {state?.messages.map((m) => (
          <div key={m.id} className={m.sender === "USER" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                m.sender === "USER"
                  ? "bg-blue-600 text-white rounded-2xl rounded-br-sm px-4 py-2 max-w-[80%] text-sm whitespace-pre-line"
                  : m.sender === "DOCTOR"
                    ? "bg-blue-50 border border-blue-200 rounded-2xl rounded-bl-sm px-4 py-2 max-w-[80%] text-sm whitespace-pre-line"
                    : "bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-2 max-w-[80%] text-sm whitespace-pre-line"
              }
            >
              {m.sender === "DOCTOR" && <p className="text-xs font-medium text-blue-700 mb-0.5">👨‍⚕️ Bác sĩ</p>}
              {m.sender === "USER" ? (
                m.content
              ) : (
                <div dangerouslySetInnerHTML={{ __html: formatChatHtml(m.content) }} />
              )}
            </div>
          </div>
        ))}
        {sending && <p className="text-sm text-gray-400">Đang trả lời...</p>}
        <div ref={bottomRef} />
      </div>

      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      <div className="flex gap-2 mt-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Nhập câu hỏi..."
          className="flex-1 border rounded-lg px-4 py-2.5 text-sm"
          disabled={sending}
        />
        <button
          onClick={send}
          disabled={sending || !input.trim()}
          className="bg-blue-600 text-white px-5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          Gửi
        </button>
      </div>
    </div>
  );
}
