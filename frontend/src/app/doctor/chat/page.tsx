"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";

interface InboxItem {
  conversationId: string;
  status: "WAITING_DOCTOR" | "WITH_DOCTOR";
  userName: string;
  lastMessage: string;
  updatedAt: string;
}

interface ChatMessage {
  id: string;
  sender: "USER" | "AI" | "DOCTOR";
  content: string;
  createdAt: string;
}

interface ChatState {
  conversationId: string;
  status: string;
  messages: ChatMessage[];
}

export default function DoctorChatPage() {
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [current, setCurrent] = useState<ChatState | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadInbox = useCallback(() => {
    api<InboxItem[]>("/api/doctor/chat/inbox").then(setInbox).catch(() => {});
  }, []);

  const loadConversation = useCallback((id: string) => {
    api<ChatState>(`/api/doctor/chat/${id}`).then(setCurrent).catch(() => {});
  }, []);

  useEffect(() => {
    loadInbox();
    const timer = setInterval(() => {
      loadInbox();
      setCurrent((c) => {
        if (c) loadConversation(c.conversationId);
        return c;
      });
    }, 5000);
    return () => clearInterval(timer);
  }, [loadInbox, loadConversation]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [current?.messages.length]);

  async function reply() {
    const content = input.trim();
    if (!content || !current || sending) return;
    setSending(true);
    setInput("");
    try {
      const s = await api<ChatState>(`/api/doctor/chat/${current.conversationId}/reply`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
      setCurrent(s);
      loadInbox();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Gửi thất bại");
    } finally {
      setSending(false);
    }
  }

  async function closeConversation() {
    if (!current || !confirm("Kết thúc tư vấn này?")) return;
    await api(`/api/doctor/chat/${current.conversationId}/close`, { method: "POST" });
    setCurrent(null);
    loadInbox();
  }

  return (
    <div className="grid md:grid-cols-3 gap-4" style={{ minHeight: "70vh" }}>
      <div className="bg-white border rounded-xl overflow-hidden">
        <p className="font-bold p-3 border-b">Hộp thư tư vấn ({inbox.length})</p>
        <div className="divide-y overflow-y-auto max-h-[65vh]">
          {inbox.length === 0 && (
            <p className="text-gray-500 text-sm p-4">Không có yêu cầu tư vấn nào.</p>
          )}
          {inbox.map((item) => (
            <button
              key={item.conversationId}
              onClick={() => loadConversation(item.conversationId)}
              className={`w-full text-left p-3 hover:bg-emerald-50 ${
                current?.conversationId === item.conversationId ? "bg-emerald-50" : ""
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="font-medium text-sm">{item.userName}</span>
                {item.status === "WAITING_DOCTOR" && (
                  <span className="text-xs bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded">mới</span>
                )}
              </div>
              <p className="text-xs text-gray-500 truncate">{item.lastMessage}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="md:col-span-2 bg-white border rounded-xl flex flex-col">
        {!current ? (
          <p className="text-gray-500 text-sm m-auto py-16">← Chọn hội thoại để trả lời</p>
        ) : (
          <>
            <div className="flex justify-between items-center p-3 border-b">
              <span className="font-medium text-sm">Hội thoại</span>
              <button onClick={closeConversation} className="text-sm text-red-600 hover:underline">
                Kết thúc tư vấn
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[50vh]">
              {current.messages.map((m) => (
                <div key={m.id} className={m.sender === "DOCTOR" ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={
                      m.sender === "DOCTOR"
                        ? "bg-emerald-600 text-white rounded-2xl rounded-br-sm px-4 py-2 max-w-[80%] text-sm whitespace-pre-line"
                        : m.sender === "AI"
                          ? "bg-gray-50 border border-dashed rounded-2xl px-4 py-2 max-w-[80%] text-sm text-gray-500 whitespace-pre-line"
                          : "bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-2 max-w-[80%] text-sm whitespace-pre-line"
                    }
                  >
                    {m.sender === "AI" && <p className="text-xs mb-0.5">🤖 AI đã trả lời</p>}
                    {m.content}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
            <div className="flex gap-2 p-3 border-t">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && reply()}
                placeholder="Trả lời bệnh nhân..."
                className="flex-1 border rounded-lg px-4 py-2 text-sm"
              />
              <button
                onClick={reply}
                disabled={sending || !input.trim()}
                className="bg-emerald-600 text-white px-4 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                Gửi
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
