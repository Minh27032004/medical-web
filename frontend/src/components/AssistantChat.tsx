"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Bot,
  Info,
  Pill,
  SendHorizontal,
  Sparkles,
  Stethoscope,
  Syringe,
  TriangleAlert,
  Trophy,
  type LucideIcon,
} from "lucide-react";
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
 *
 * `intent` + `range` là TẦNG 0: chip là câu cố định nên intent đã biết chắc, gửi thẳng cho
 * backend thay vì để nó nhờ Gemini đoán lại. Đo trên production: bỏ được ~740ms mỗi lượt.
 * Vẫn gửi kèm `question` dạng chữ để hiển thị trong khung chat và lưu vào lịch sử.
 */
interface Suggestion {
  label: string;
  intent: string;
  range?: "TODAY" | "THIS_MONTH" | "LAST_MONTH" | "THIS_WEEK";
  question?: string;
  ask?: string;
  build?: (value: string) => string;
}

const SUGGESTIONS: Suggestion[] = [
  {
    label: "Bệnh nhân khám hôm nay",
    intent: "VISITS_BY_DATE",
    range: "TODAY",
    question: "Bệnh nhân khám hôm nay",
  },
  {
    label: "Lần khám có tiêm hôm nay",
    intent: "INJECTION_BY_DATE",
    range: "TODAY",
    question: "Các lần khám có tiêm hôm nay",
  },
  {
    label: "Tháng này ai khám nhiều nhất",
    intent: "TOP_PATIENTS",
    range: "THIS_MONTH",
    question: "Tháng này bệnh nhân nào khám nhiều nhất",
  },
  {
    label: "Bệnh gì gặp nhiều nhất tuần này",
    intent: "TOP_DIAGNOSES",
    range: "THIS_WEEK",
    question: "Tuần này bệnh gì gặp nhiều nhất",
  },
  {
    label: "Thuốc kê nhiều nhất tháng này",
    intent: "TOP_MEDICINES",
    range: "THIS_MONTH",
    question: "Tháng này thuốc nào được kê nhiều nhất",
  },
  { label: "Thuốc nào sắp hết", intent: "LOW_STOCK", question: "Thuốc nào sắp hết" },
  { label: "Thuốc nào tồn thấp nhất", intent: "LOWEST_STOCK", question: "Thuốc nào tồn thấp nhất" },
  {
    label: "Lịch sử khám của…",
    intent: "PATIENT_HISTORY",
    ask: "Tên bệnh nhân?",
    build: (v) => `Lịch sử khám của ${v}`,
  },
  {
    label: "… khám gần nhất khi nào",
    intent: "LAST_VISIT",
    ask: "Tên bệnh nhân?",
    build: (v) => `${v} khám gần nhất khi nào`,
  },
  {
    label: "Tháng này … khám mấy lần",
    intent: "VISIT_COUNT",
    range: "THIS_MONTH",
    ask: "Tên bệnh nhân?",
    build: (v) => `Tháng này ${v} khám mấy lần`,
  },
  {
    label: "Tồn kho thuốc…",
    intent: "MEDICINE_STOCK",
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
  const [showSuggestions, setShowSuggestions] = useState(false); // bảng chip sau lượt đầu
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

  /**
   * @param direct khi bác sĩ bấm chip: intent đã biết chắc nên gửi kèm để backend khỏi hỏi
   *   Gemini. Bỏ trống (tự gõ câu hỏi) thì backend phân loại như cũ.
   */
  async function ask(
    question: string,
    direct?: { intent: string; name?: string; range?: string }
  ) {
    const q = question.trim();
    if (!q || loading) return;
    setInput("");
    setLoading(true);
    const idx = turns.length;
    setTurns((t) => [...t, { question: q }]);
    try {
      const response = await api<ChatResponse>("/api/doctor/chat", {
        method: "POST",
        // turnIndex: câu đầu phiên (0) thì backend khỏi query bảng ngữ cảnh — chắc chắn rỗng.
        body: JSON.stringify({ question: q, sessionId, turnIndex: idx, ...direct }),
      });
      setTurns((t) => t.map((turn, i) => (i === idx ? { ...turn, response } : turn)));
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Lỗi truy vấn";
      setTurns((t) => t.map((turn, i) => (i === idx ? { ...turn, error: msg } : turn)));
    } finally {
      setLoading(false);
    }
  }

  /** Bấm chip: gửi kèm intent (tầng 0). Chip cần tên thì mở ô nhập trước. */
  function pickSuggestion(sg: Suggestion) {
    if (sg.ask) {
      setPending(sg);
      setPendingValue("");
      return;
    }
    setShowSuggestions(false);
    ask(sg.question!, { intent: sg.intent, range: sg.range });
  }

  /** Gửi chip loại cần tên, sau khi bác sĩ đã nhập. */
  function submitPending() {
    const v = pendingValue.trim();
    if (!pending || !v) return;
    setPending(null);
    setShowSuggestions(false);
    ask(pending.build!(v), { intent: pending.intent, name: v, range: pending.range });
  }

  /**
   * Hàm thường (không phải component) nên JSX được nội tuyến vào cây hiện tại — nếu tách
   * thành component định nghĩa bên trong AssistantChat thì mỗi lần render là một type mới,
   * React remount và ô nhập tên mất focus ngay khi gõ chữ đầu tiên.
   */
  function renderSuggestions() {
    return (
      <div>
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((sg) => (
            <button
              key={sg.label}
              onClick={() => pickSuggestion(sg)}
              className={`rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors ${
                pending?.label === sg.label
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-gray-300 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
              }`}
            >
              {sg.label}
            </button>
          ))}
        </div>

        {/* Gợi ý cần thêm thông tin: hỏi ngay tại chỗ rồi ghép thành câu hoàn chỉnh */}
        {pending && (
          <div className="mt-3 border border-blue-200 bg-blue-50/60 rounded-xl p-3">
            <label className="block text-sm font-medium text-blue-900 mb-2">{pending.ask}</label>
            <div className="flex gap-2">
              <input
                value={pendingValue}
                onChange={(e) => setPendingValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitPending();
                  if (e.key === "Escape") setPending(null);
                }}
                placeholder={pending.ask?.includes("thuốc") ? "VD: Paracetamol" : "VD: Nguyễn Văn A"}
                className="input flex-1"
                autoFocus
              />
              <button onClick={submitPending} disabled={!pendingValue.trim()} className="btn-primary">
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
    );
  }

  return (
    <div className="@container flex h-full min-h-0 flex-col">
      {/* ===== Dòng hội thoại ===== */}
      <div className="flex-1 space-y-5 overflow-y-auto overflow-x-hidden pr-1">
        {turns.length === 0 && (
          <div className="pt-1">
            <p className="mb-3 text-sm text-gray-500">
              Tôi tra cứu được dữ liệu phòng khám của bạn. Chọn một câu hỏi hoặc tự gõ:
            </p>
            {renderSuggestions()}
          </div>
        )}

        {turns.map((turn, i) => (
          <div key={i} className="space-y-3">
            {/* Câu hỏi — bong bóng bên phải */}
            <div className="flex justify-end">
              <span className="max-w-[85%] break-words rounded-2xl rounded-br-md bg-blue-600 px-4 py-2 text-sm text-white shadow-xs">
                {turn.question}
              </span>
            </div>

            {/* Câu trả lời — có avatar để phân biệt rõ ai đang nói */}
            {(turn.response || turn.error) && (
              <div className="flex gap-2.5">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <Bot size={18} strokeWidth={1.8} />
                </span>
                <div className="min-w-0 flex-1">
                  {turn.error ? (
                    <div className="flex items-start gap-2 rounded-2xl rounded-tl-md border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
                      <TriangleAlert size={16} strokeWidth={1.8} className="mt-0.5 shrink-0" />
                      <span>{turn.error}</span>
                    </div>
                  ) : (
                    <ResultBlock r={turn.response!} />
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Đang tra cứu — ba chấm nhấp nháy thay cho một dòng chữ đứng im: bác sĩ thấy được
            hệ thống đang chạy chứ không phải đã treo. */}
        {loading && (
          <div className="flex gap-2.5">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <Bot size={18} strokeWidth={1.8} />
            </span>
            <span className="flex items-center gap-1 rounded-2xl rounded-tl-md border border-gray-200 bg-white px-4 py-3 shadow-xs">
              {[0, 1, 2].map((d) => (
                <span
                  key={d}
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400"
                  style={{ animationDelay: `${d * 0.15}s` }}
                />
              ))}
            </span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Sau lượt đầu, chip biến mất khiến bác sĩ phải tự gõ — mà câu gõ tay thì phải nhờ
          Gemini đoán intent, chậm hơn ~740ms so với bấm chip. Giữ chip lấy được qua nút
          "Gợi ý" để đường nhanh vẫn dùng được suốt phiên. */}
      {turns.length > 0 && showSuggestions && (
        <div className="mt-3 border-t border-gray-100 pt-3">{renderSuggestions()}</div>
      )}

      {/* ===== Ô nhập ===== */}
      <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3">
        {turns.length > 0 && (
          <button
            onClick={() => setShowSuggestions((v) => !v)}
            title="Câu hỏi gợi ý (trả lời nhanh hơn câu tự gõ)"
            aria-label="Câu hỏi gợi ý"
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors ${
              showSuggestions
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-gray-300 text-gray-500 hover:bg-gray-50"
            }`}
          >
            <Sparkles size={18} strokeWidth={1.8} />
          </button>
        )}

        <div className="relative min-w-0 flex-1">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask(input)}
            placeholder="Hỏi về ca khám, tồn kho, thống kê..."
            className="w-full rounded-full border border-gray-300 bg-white py-2.5 pl-4 pr-12 text-sm text-gray-900 shadow-xs outline-none transition-shadow placeholder:text-gray-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100 disabled:bg-gray-50"
            disabled={loading}
          />
          <button
            onClick={() => ask(input)}
            disabled={loading || !input.trim()}
            aria-label="Gửi"
            className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400"
          >
            <SendHorizontal size={16} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===================== Khối kết quả ===================== */

/** Icon + tông màu theo loại câu trả lời — liếc là biết câu trả lời nói về cái gì. */
function intentLook(intent: string): { Icon: LucideIcon; tone: string } {
  if (intent.startsWith("TOP_")) return { Icon: Trophy, tone: "bg-amber-50 text-amber-700" };
  if (intent.startsWith("INJECTION")) return { Icon: Syringe, tone: "bg-purple-50 text-purple-600" };
  if (intent === "LOW_STOCK" || intent === "LOWEST_STOCK") {
    return { Icon: TriangleAlert, tone: "bg-red-50 text-red-600" };
  }
  if (intent === "MEDICINE_STOCK") return { Icon: Pill, tone: "bg-amber-50 text-amber-700" };
  if (intent === "UNKNOWN") return { Icon: Info, tone: "bg-gray-100 text-gray-500" };
  return { Icon: Stethoscope, tone: "bg-blue-50 text-blue-600" };
}

/**
 * Thẻ kết quả.
 *
 * Cùng một component phục vụ HAI khung rất khác nhau: trang /chat rộng ~768px và widget nổi
 * ~380px. Nên bảng dữ liệu đổi dạng theo bề rộng KHUNG CHỨA (container query @md), không
 * theo bề rộng MÀN HÌNH: khung rộng thì hiện bảng thật — dễ dò theo cột; khung hẹp thì xếp
 * dọc nhãn–giá trị để khỏi cuộn ngang. Dùng breakpoint màn hình (sm:) sẽ sai ở widget, vì
 * màn hình rộng nhưng khung thì không.
 */
function ResultBlock({ r }: { r: ChatResponse }) {
  const { Icon, tone } = intentLook(r.intent);
  const columns = r.rows.length > 0 ? Object.keys(r.rows[0]).filter((c) => c !== "visitId") : [];
  const hasLink = r.rows.some((row) => row.visitId != null);

  // Chỉ có lời nhắn, không có bảng: một bong bóng chữ là đủ, đóng khung thành thẻ chỉ tổ nặng nề.
  if (r.rows.length === 0) {
    return (
      <div className="rounded-2xl rounded-tl-md border border-gray-200 bg-white px-4 py-3 text-sm break-words text-gray-700 shadow-xs">
        {r.message ?? r.title ?? "Không có kết quả."}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl rounded-tl-md border border-gray-200 bg-white shadow-xs">
      <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-2.5">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${tone}`}>
          <Icon size={15} strokeWidth={1.8} />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">
          {r.title ?? "Kết quả"}
        </span>
        <span className="shrink-0 rounded-full border border-gray-200 bg-white px-2 py-0.5 text-xs font-medium text-gray-500">
          {r.rows.length}
        </span>
      </div>

      {/* Câu chốt (nếu có) đặt TRÊN bảng và in đậm: với các câu "ai/cái gì nhiều nhất",
          đây mới là câu trả lời, còn bảng chỉ là phần chứng minh. */}
      {r.message && (
        <p className="border-b border-gray-100 px-4 py-2.5 text-sm font-medium break-words text-gray-900">
          {r.message}
        </p>
      )}

      {/* Khung RỘNG — bảng thật */}
      <div className="hidden @md:block">
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th
                    key={c}
                    className="border-b border-gray-200 bg-gray-50/60 px-4 py-2 text-left text-xs font-semibold tracking-wide whitespace-nowrap text-gray-500 uppercase"
                  >
                    {c}
                  </th>
                ))}
                {hasLink && <th className="border-b border-gray-200 bg-gray-50/60 px-4 py-2" />}
              </tr>
            </thead>
            <tbody>
              {r.rows.map((row, i) => (
                <tr key={i} className="hover:[&>td]:bg-gray-50">
                  {columns.map((c) => (
                    <td
                      key={c}
                      className="border-b border-gray-100 px-4 py-2 align-middle text-gray-700"
                    >
                      {String(row[c] ?? "")}
                    </td>
                  ))}
                  {hasLink && (
                    <td className="border-b border-gray-100 px-4 py-2 text-right whitespace-nowrap">
                      {row.visitId != null && (
                        <Link
                          href={`/visits/${row.visitId}`}
                          className="text-xs font-medium text-blue-700 hover:underline"
                        >
                          Xem →
                        </Link>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Khung HẸP — xếp dọc nhãn / giá trị */}
      <div className="divide-y divide-gray-100 @md:hidden">
        {r.rows.map((row, i) => (
          <div key={i} className="px-4 py-2.5 text-sm">
            {columns.map((c) => (
              <div key={c} className="flex justify-between gap-3 py-0.5">
                <span className="shrink-0 text-gray-500">{c}</span>
                <span className="min-w-0 text-right break-words">{String(row[c] ?? "")}</span>
              </div>
            ))}
            {row.visitId != null && (
              <div className="mt-1 text-right">
                <Link
                  href={`/visits/${row.visitId}`}
                  className="text-xs font-medium text-blue-700 hover:underline"
                >
                  Xem →
                </Link>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
