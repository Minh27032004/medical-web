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

/**
 * Gợi ý câu hỏi. Loại có `ask` cần thêm một thông tin (tên bệnh nhân / tên thuốc) —
 * bấm vào sẽ hỏi ngay tại chỗ rồi mới gửi, thay vì bắt bác sĩ tự gõ cả câu.
 */
interface Suggestion {
  label: string;
  question?: string;
  ask?: string;
  build?: (value: string) => string;
}

const SUGGESTIONS: Suggestion[] = [
  { label: "Bệnh nhân khám hôm nay", question: "Bệnh nhân khám hôm nay" },
  { label: "Lần khám có tiêm hôm nay", question: "Các lần khám có tiêm hôm nay" },
  { label: "Thuốc nào sắp hết", question: "Thuốc nào sắp hết" },
  { label: "Thuốc nào tồn thấp nhất", question: "Thuốc nào tồn thấp nhất" },
  {
    label: "Lịch sử khám của…",
    ask: "Tên bệnh nhân?",
    build: (v) => `Lịch sử khám của ${v}`,
  },
  {
    label: "… khám gần nhất khi nào",
    ask: "Tên bệnh nhân?",
    build: (v) => `${v} khám gần nhất khi nào`,
  },
  {
    label: "Tháng này … khám mấy lần",
    ask: "Tên bệnh nhân?",
    build: (v) => `Tháng này ${v} khám mấy lần`,
  },
  {
    label: "Tồn kho thuốc…",
    ask: "Tên thuốc?",
    build: (v) => `Tồn kho ${v}`,
  },
];

/** Lõi chat trợ lý — dùng chung cho trang /chat và widget nổi. Tự lấp đầy chiều cao cha, cuộn nội bộ. */
export default function AssistantChat() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<Suggestion | null>(null); // gợi ý đang chờ nhập tên
  const [pendingValue, setPendingValue] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  /**
   * Mỗi lần MỞ chat là một phiên mới: màn hình trống và backend cũng KHÔNG kế thừa ngữ
   * cảnh của phiên trước. Nếu chỉ xóa hiển thị mà giữ ngữ cảnh cũ, câu "tháng này khám
   * mấy lần?" sẽ trả lời về bệnh nhân của phiên hôm trước mà không ai biết.
   */
  const [sessionId] = useState(() => crypto.randomUUID());

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
        body: JSON.stringify({ question: q, sessionId }),
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
          <div>
            <p className="text-sm text-gray-500 mb-3">
              Tôi tra cứu được dữ liệu phòng khám của bạn. Chọn một câu hỏi hoặc tự gõ:
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((sg) => (
                <button
                  key={sg.label}
                  onClick={() => {
                    if (sg.ask) { setPending(sg); setPendingValue(""); }
                    else ask(sg.question!);
                  }}
                  className={`text-sm rounded-full px-3 py-1.5 border transition-colors ${
                    pending?.label === sg.label
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-blue-300 text-blue-700 hover:bg-blue-50"
                  }`}
                >
                  {sg.label}
                </button>
              ))}
            </div>

            {/* Gợi ý cần thêm thông tin: hỏi ngay tại chỗ rồi ghép thành câu hoàn chỉnh */}
            {pending && (
              <div className="mt-3 border border-blue-200 bg-blue-50/60 rounded-xl p-3">
                <label className="block text-sm font-medium text-blue-900 mb-2">
                  {pending.ask}
                </label>
                <div className="flex gap-2">
                  <input
                    value={pendingValue}
                    onChange={(e) => setPendingValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && pendingValue.trim()) {
                        ask(pending.build!(pendingValue.trim()));
                        setPending(null);
                      }
                      if (e.key === "Escape") setPending(null);
                    }}
                    placeholder={pending.ask?.includes("thuốc") ? "VD: Paracetamol" : "VD: Nguyễn Văn A"}
                    className="input flex-1"
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      if (!pendingValue.trim()) return;
                      ask(pending.build!(pendingValue.trim()));
                      setPending(null);
                    }}
                    disabled={!pendingValue.trim()}
                    className="btn-primary"
                  >
                    Hỏi
                  </button>
                  <button onClick={() => setPending(null)} className="btn-ghost">Bỏ</button>
                </div>
                {pendingValue.trim() && (
                  <p className="text-xs text-blue-800 mt-2">
                    Sẽ hỏi: “{pending.build!(pendingValue.trim())}”
                  </p>
                )}
              </div>
            )}
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

      <div className="flex gap-2 pt-2 border-t border-gray-100 mt-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask(input)}
          placeholder="Nhập câu hỏi..."
          className="input flex-1"
          disabled={loading}
        />
        <button
          onClick={() => ask(input)}
          disabled={loading || !input.trim()}
          className="btn-primary px-5"
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
    return <div className="bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm text-gray-700 break-words shadow-sm">{r.message}</div>;
  }
  const columns = r.rows.length > 0 ? Object.keys(r.rows[0]).filter((c) => c !== "visitId") : [];
  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
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
