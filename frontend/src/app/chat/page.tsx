"use client";

import Link from "next/link";
import { useRef, useState } from "react";
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

export default function ChatPage() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

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
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-xl font-bold mb-1">Tra cứu nhanh</h1>
      <p className="text-sm text-gray-500 mb-4">
        Hỏi bằng tiếng Việt về dữ liệu phòng khám của bạn. Trợ lý chỉ đọc dữ liệu, không chẩn đoán.
      </p>

      {turns.length === 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
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

      <div className="space-y-4 mb-4">
        {turns.map((turn, i) => (
          <div key={i}>
            <div className="flex justify-end mb-2">
              <span className="bg-blue-600 text-white rounded-2xl rounded-br-sm px-4 py-2 text-sm">
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

      <div className="flex gap-2 sticky bottom-4 bg-gray-50 pt-2">
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

function ResultBlock({ r }: { r: ChatResponse }) {
  if (r.message && r.rows.length === 0) {
    return <div className="bg-white border rounded-xl px-4 py-3 text-sm text-gray-700">{r.message}</div>;
  }
  const columns = r.rows.length > 0 ? Object.keys(r.rows[0]).filter((c) => c !== "visitId") : [];
  return (
    <div className="bg-white border rounded-xl overflow-hidden">
      {r.title && <p className="px-4 py-2 bg-blue-50 text-sm font-medium text-blue-900">{r.title}</p>}
      {r.rows.length === 0 ? (
        <p className="px-4 py-3 text-sm text-gray-500">Không có kết quả.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                {columns.map((c) => <th key={c} className="p-2.5">{c}</th>)}
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {r.rows.map((row, i) => (
                <tr key={i}>
                  {columns.map((c) => <td key={c} className="p-2.5">{String(row[c] ?? "")}</td>)}
                  <td className="p-2.5 text-right">
                    {row.visitId != null && (
                      <Link href={`/visits/${row.visitId}`} className="text-blue-700 hover:underline text-xs whitespace-nowrap">
                        Xem →
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
