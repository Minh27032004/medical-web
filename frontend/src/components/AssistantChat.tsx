"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { ChatResponse } from "@/lib/types";

interface Turn {
  question: string;
  response?: ChatResponse;
  error?: string;
}

const EXAMPLES = [
  "Bệnh nhân khám hôm nay",
  "Các đơn có tiêm thuốc hôm nay",
  "Thuốc nào sắp hết",
  "Lịch sử khám của Nguyễn Văn A",
];

/** Lõi chat trợ lý — dùng chung cho trang /chat và widget nổi. Tự lấp đầy chiều cao cha, cuộn nội bộ. */
export default function AssistantChat() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, loading]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || loading) return;
    setInput("");
    setLoading(true);
    const idx = turns.length;
    setTurns((t) => [...t, { question: q }]);
    try {
      const response = await api<ChatResponse>("/api/doctor/chat", {
        method: "POST",
        body: JSON.stringify({ question: q }),
      });
      setTurns((t) => t.map((turn, i) => (i === idx ? { ...turn, response } : turn)));
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Lỗi truy vấn";
      setTurns((t) => t.map((turn, i) => (i === idx ? { ...turn, error: msg } : turn)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-4 pr-1">
        {turns.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => ask(ex)}
                className="text-sm border border-blue-300 text-blue-700 rounded-full px-3 py-1.5 hover:bg-blue-50"
              >
                {ex}
              </button>
            ))}
          </div>
        )}

        {turns.map((turn, i) => (
          <div key={i}>
            <div className="flex justify-end mb-2">
              <span className="bg-blue-600 text-white rounded-2xl rounded-br-sm px-4 py-2 text-sm max-w-[85%] break-words">
                {turn.question}
              </span>
            </div>
            {turn.error && <p className="text-red-600 text-sm">{turn.error}</p>}
            {turn.response && <ResultBlock r={turn.response} />}
          </div>
        ))}
        {loading && <p className="text-gray-400 text-sm">Đang tra cứu...</p>}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 pt-2 border-t mt-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask(input)}
          placeholder="Nhập câu hỏi..."
          className="flex-1 border rounded-lg px-4 py-2.5 text-sm bg-white"
          disabled={loading}
        />
        <button
          onClick={() => ask(input)}
          disabled={loading || !input.trim()}
          className="bg-blue-600 text-white px-5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          Gửi
        </button>
      </div>
    </div>
  );
}

/** Kết quả dạng THẺ xếp dọc (nhãn — giá trị) để luôn gọn trong khung, không cần cuộn ngang. */
function ResultBlock({ r }: { r: ChatResponse }) {
  if (r.message && r.rows.length === 0) {
    return <div className="bg-white border rounded-xl px-4 py-3 text-sm text-gray-700 break-words">{r.message}</div>;
  }
  const columns = r.rows.length > 0 ? Object.keys(r.rows[0]).filter((c) => c !== "visitId") : [];
  return (
    <div className="bg-white border rounded-xl overflow-hidden">
      {r.title && <p className="px-4 py-2 bg-blue-50 text-sm font-medium text-blue-900 break-words">{r.title}</p>}
      {r.rows.length === 0 ? (
        <p className="px-4 py-3 text-sm text-gray-500">Không có kết quả.</p>
      ) : (
        <div className="divide-y">
          {r.rows.map((row, i) => (
            <div key={i} className="px-4 py-2.5 text-sm">
              {columns.map((c) => (
                <div key={c} className="flex justify-between gap-3 py-0.5">
                  <span className="text-gray-500 shrink-0">{c}</span>
                  <span className="min-w-0 text-right break-words">{String(row[c] ?? "")}</span>
                </div>
              ))}
              {row.visitId != null && (
                <div className="text-right mt-1">
                  <Link href={`/visits/${row.visitId}`} className="text-blue-700 hover:underline text-xs">
                    Xem →
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
