"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { VisitRow } from "@/lib/types";

function toDateStr(d: Date) {
  return d.toLocaleDateString("sv-SE");
}

export default function HistoryPage() {
  const today = toDateStr(new Date());
  const monthAgo = toDateStr(new Date(Date.now() - 30 * 86400000));
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api<VisitRow[]>(`/api/doctor/visits?from=${from}&to=${to}`)
      .then(setVisits)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [from, to]);

  useEffect(load, [load]);

  // Gom theo ngày cho dễ đọc
  const byDay = visits.reduce<Record<string, VisitRow[]>>((acc, v) => {
    const day = new Date(v.visitDate).toLocaleDateString("vi-VN");
    (acc[day] ||= []).push(v);
    return acc;
  }, {});

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h1 className="text-xl font-bold">Lịch sử khám</h1>
        <div className="flex items-center gap-2 text-sm">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border rounded-lg px-2 py-1.5" />
          <span>→</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border rounded-lg px-2 py-1.5" />
        </div>
      </div>

      {loading && <p className="text-gray-500 py-8 text-center">Đang tải...</p>}
      {!loading && visits.length === 0 && (
        <p className="text-gray-500 py-8 text-center">Không có lần khám nào trong khoảng này.</p>
      )}

      <div className="space-y-5">
        {Object.entries(byDay).map(([day, rows]) => (
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
    </div>
  );
}
