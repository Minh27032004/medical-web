"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import Pager from "@/components/Pager";
import { Badge, EmptyState, IconSyringe, Loading } from "@/components/ui";
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
  const [deleting, setDeleting] = useState<VisitRow | null>(null); // lần khám chờ xác nhận xóa
  const [restoreStock, setRestoreStock] = useState(false);

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

  /** Xóa mềm lần khám; restoreStock do bác sĩ tick trên popup (cộng trả thuốc vào kho). */
  async function removeVisit() {
    await api(`/api/doctor/visits/${deleting!.id}?restoreStock=${restoreStock}`, { method: "DELETE" });
    load();
  }

  function pickPreset(n: number) {
    setFrom(daysAgo(n));
    setTo(daysAgo(0));
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h1 className="page-title">Lịch sử khám</h1>
        <div className="flex items-center gap-2 text-sm">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input w-auto" />
          <span className="text-gray-400">→</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input w-auto" />
        </div>
      </div>

      <div className="flex gap-2 mb-4 text-sm flex-wrap">
        {QUICK.map(([label, n]) => (
          <button
            key={label}
            onClick={() => pickPreset(n)}
            className={`chip ${activePreset === n ? "chip-active" : ""}`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && <Loading />}
      {!loading && visits.length === 0 && (
        <EmptyState
          title="Không có lần khám nào trong khoảng này"
          hint="Thử mở rộng khoảng ngày, hoặc chọn nhanh 30 ngày ở trên."
        />
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
              {/* Nút xóa nằm NGOÀI thẻ Link — lồng button trong <a> vừa sai HTML vừa
                  khiến bấm xóa lại điều hướng sang trang chi tiết. */}
              {rows.map((v) => (
                <div
                  key={v.id}
                  className="card flex items-center gap-3 px-4 py-3.5 hover:border-blue-300 transition-colors"
                >
                  <Link href={`/visits/${v.id}`} className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-ink">{v.patientName}</span>
                        <span className="text-gray-500 text-sm">
                          {v.diagnosisCode} — {v.diagnosisName}
                        </span>
                        {v.hasInjection && (
                          <Badge tone="purple" icon={<IconSyringe size={12} />}>tiêm</Badge>
                        )}
                      </div>
                      <span className="text-sm text-gray-400">
                        {new Date(v.visitDate).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </Link>
                  <button
                    onClick={() => { setDeleting(v); setRestoreStock(false); }}
                    className="text-sm font-medium text-red-600 hover:underline shrink-0"
                  >
                    Xóa
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Pager page={page} totalPages={totalPages} onPage={setPage} />

      <ConfirmDialog
        open={!!deleting}
        title="Xóa lần khám này?"
        message={
          <>
            {deleting?.patientName} — {deleting?.diagnosisCode} {deleting?.diagnosisName}.
            Lần khám sẽ bị ẩn khỏi lịch sử; đơn thuốc đã in vẫn được lưu trong hệ thống.
          </>
        }
        onConfirm={removeVisit}
        onClose={() => setDeleting(null)}
      >
        <label className="flex items-start gap-2 text-sm bg-gray-50 border rounded-lg p-3 cursor-pointer">
          <input
            type="checkbox"
            checked={restoreStock}
            onChange={(e) => setRestoreStock(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium">Hoàn thuốc về kho</span>
            <span className="block text-xs text-gray-500 mt-0.5">
              Tick nếu xóa vì nhập nhầm và thuốc CHƯA phát cho bệnh nhân. Nếu đã phát thuốc rồi
              thì để trống để tồn kho giữ nguyên.
            </span>
          </span>
        </label>
      </ConfirmDialog>
    </div>
  );
}
