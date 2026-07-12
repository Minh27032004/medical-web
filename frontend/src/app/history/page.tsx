"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import Pager from "@/components/Pager";
import { api } from "@/lib/api";
import type { VisitRow } from "@/lib/types";

const PAGE_SIZE = 10;

function toDateStr(d: Date) {
  return d.toLocaleDateString("sv-SE"); // yyyy-mm-dd
}

/** Lùi n ngày kể từ hôm nay (n=0 → hôm nay). */
function daysAgo(n: number) {
  return toDateStr(new Date(Date.now() - n * 86400000));
}

const QUICK = [
  ["Hôm nay", 0],
  ["3 ngày", 2],
  ["7 ngày", 6],
  ["30 ngày", 29],
] as const;

export default function HistoryPage() {
  const [from, setFrom] = useState(daysAgo(6));
  const [to, setTo] = useState(daysAgo(0));
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    api<VisitRow[]>(`/api/doctor/visits?from=${from}&to=${to}`)
      .then(setVisits)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [from, to]);

  useEffect(load, [load]);
  useEffect(() => setPage(0), [from, to]); // đổi khoảng ngày → về trang đầu

  const totalPages = Math.max(1, Math.ceil(visits.length / PAGE_SIZE));
  const pageVisits = visits.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  // Gom theo ngày cho dễ đọc (trong phạm vi trang hiện tại).
  const byDay = useMemo(() => {
    const map = new Map<string, VisitRow[]>();
    for (const v of pageVisits) {
      const day = new Date(v.visitDate).toLocaleDateString("vi-VN");
      const arr = map.get(day);
      if (arr) arr.push(v);
      else map.set(day, [v]);
    }
    return [...map.entries()];
  }, [pageVisits]);

  // Nút filter đang chọn? so khớp from/to với preset.
  const activePreset = QUICK.find(([, n]) => from === daysAgo(n) && to === daysAgo(0))?.[1];

  function pickPreset(n: number) {
    setFrom(daysAgo(n));
    setTo(daysAgo(0));
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <h1 className="text-xl font-bold">Lịch sử khám</h1>
        <div className="flex items-center gap-2 text-sm">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border rounded-lg px-2 py-1.5" />
          <span>→</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border rounded-lg px-2 py-1.5" />
        </div>
      </div>

      <div className="flex gap-1.5 mb-4 text-sm flex-wrap">
        {QUICK.map(([label, n]) => (
          <button
            key={label}
            onClick={() => pickPreset(n)}
            className={`px-3 py-1.5 rounded-lg border ${
              activePreset === n ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 hover:bg-gray-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && <p className="text-gray-500 py-8 text-center">Đang tải...</p>}
      {!loading && visits.length === 0 && (
        <p className="text-gray-500 py-8 text-center">Không có lần khám nào trong khoảng này.</p>
      )}

      {!loading && visits.length > 0 && (
        <p className="text-xs text-gray-400 mb-2">{visits.length} lượt khám</p>
      )}

      <div className="space-y-5">
        {byDay.map(([day, rows]) => (
          <div key={day}>
            <p className="text-sm font-semibold text-gray-500 mb-2">
              {day} · {rows.length} lượt khám
            </p>
            <div className="space-y-2">
              {rows.map((v) => (
                <Link
                  key={v.id}
                  href={`/visits/${v.id}`}
                  className="block bg-white border rounded-xl px-4 py-3 hover:border-blue-400"
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <span className="font-medium">{v.patientName}</span>
                      <span className="text-gray-500 text-sm ml-2">
                        {v.diagnosisCode} — {v.diagnosisName}
                      </span>
                      {v.hasInjection && (
                        <span className="ml-2 text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded">💉 tiêm</span>
                      )}
                    </div>
                    <span className="text-sm text-gray-400">
                      {new Date(v.visitDate).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Pager page={page} totalPages={totalPages} onPage={setPage} />
    </div>
  );
}
