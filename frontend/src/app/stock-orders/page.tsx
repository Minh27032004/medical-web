"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import {
  Badge, EmptyState, IconAlert, IconPlus, IconSearch, LoadError, Loading,
} from "@/components/ui";
import { api, apiDownload, ApiError } from "@/lib/api";
import {
  STOCK_ORDER_STATUS_LABEL,
  type Medicine, type Page, type StockOrder, type StockSuggestion,
} from "@/lib/types";

/** Một dòng trong đơn đang soạn (chưa lưu). */
interface DraftLine {
  medicineId: string;
  medicineName: string;
  unitName: string;
  qty: string;
  units: { unitName: string; label: string }[];
  stockDisplay: string | null;
}

type Mode = null | "QUICK" | "MANUAL";

export default function StockOrdersPage() {
  const [orders, setOrders] = useState<StockOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const [mode, setMode] = useState<Mode>(null);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [receiving, setReceiving] = useState<StockOrder | null>(null);
  const [cancelling, setCancelling] = useState<StockOrder | null>(null);

  const load = useCallback(() => {
    api<StockOrder[]>("/api/doctor/stock-orders")
      .then((list) => { setOrders(list); setLoadFailed(false); })
      .catch(() => setLoadFailed(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const pending = useMemo(() => orders.filter((o) => o.status === "PENDING"), [orders]);
  const done = useMemo(() => orders.filter((o) => o.status !== "PENDING"), [orders]);

  /** Nhập nhanh: kéo danh sách thuốc sắp hết, mỗi thuốc 1 đơn vị lớn nhất. */
  async function startQuick() {
    setError("");
    setBusy(true);
    try {
      const sug = await api<StockSuggestion[]>("/api/doctor/stock-orders/quick-suggestions");
      if (sug.length === 0) {
        setError("Không có thuốc nào dưới ngưỡng cảnh báo. Dùng \"Nhập thủ công\" nếu vẫn muốn đặt.");
        setBusy(false);
        return;
      }
      setLines(sug.map((s) => ({
        medicineId: s.medicineId,
        medicineName: s.medicineName,
        unitName: s.defaultUnitName,
        qty: String(s.defaultQty),
        units: s.units,
        stockDisplay: s.stockDisplay,
      })));
      setNote("");
      setMode("QUICK");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không tải được danh sách thuốc sắp hết");
    } finally {
      setBusy(false);
    }
  }

  function startManual() {
    setError("");
    setLines([]);
    setNote("");
    setMode("MANUAL");
  }

  function closeDraft() {
    setMode(null);
    setLines([]);
    setNote("");
    setError("");
  }

  function addLine(m: Medicine) {
    if (lines.some((l) => l.medicineId === m.id)) return; // đã có trong đơn
    setLines((ls) => [...ls, {
      medicineId: m.id,
      medicineName: m.name,
      unitName: m.units[0]?.unitName ?? m.baseUnit,
      qty: "1",
      units: m.units.map((u) => ({ unitName: u.unitName, label: u.label })),
      stockDisplay: m.stockDisplay,
    }]);
  }

  function updateLine(i: number, patch: Partial<DraftLine>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  /** Lưu đơn (trạng thái chờ) rồi tải file .xlsx về. */
  async function exportDraft() {
    setError("");
    const items = lines
      .filter((l) => Number(l.qty) > 0)
      .map((l) => ({ medicineId: l.medicineId, unitName: l.unitName, qty: Number(l.qty) }));
    if (items.length === 0) {
      setError("Nhập số lượng cho ít nhất 1 dòng thuốc");
      return;
    }
    setBusy(true);
    try {
      const created = await api<StockOrder>("/api/doctor/stock-orders", {
        method: "POST",
        body: JSON.stringify({ source: mode, note: note.trim() || null, items }),
      });
      await apiDownload(`/api/doctor/stock-orders/${created.id}/export`, `${created.code}.xlsx`);
      closeDraft();
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Lưu đơn thất bại");
    } finally {
      setBusy(false);
    }
  }

  async function receive(o: StockOrder) {
    await api(`/api/doctor/stock-orders/${o.id}/receive`, { method: "POST" });
    load();
  }

  async function cancel(o: StockOrder) {
    await api(`/api/doctor/stock-orders/${o.id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
        <h1 className="page-title">Nhập kho</h1>
        {!mode && (
          <div className="flex gap-2">
            <button onClick={startQuick} disabled={busy} className="btn-primary">
              <IconAlert size={16} />
              {busy ? "Đang tải..." : "Nhập nhanh"}
            </button>
            <button onClick={startManual} className="btn-ghost">
              <IconPlus />
              Nhập thủ công
            </button>
          </div>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-5">
        Lập đơn đặt thuốc, xuất file gửi nhà thuốc. Tồn kho <strong>chỉ tăng khi bạn xác nhận</strong>{" "}
        đã nhận đủ hàng — đơn đang chờ không ảnh hưởng số tồn.
      </p>

      {!mode && error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      {mode && (
        <DraftCard
          mode={mode}
          lines={lines}
          note={note}
          busy={busy}
          error={error}
          onNote={setNote}
          onUpdateLine={updateLine}
          onRemoveLine={(i) => setLines((ls) => ls.filter((_, idx) => idx !== i))}
          onAddLine={addLine}
          onExport={exportDraft}
          onCancel={closeDraft}
        />
      )}

      {loading && <Loading />}
      {!loading && loadFailed && <LoadError onRetry={() => { setLoading(true); load(); }} />}

      {!loading && !loadFailed && orders.length === 0 && !mode && (
        <EmptyState
          title="Chưa có đơn nhập kho nào"
          hint="Bấm “Nhập nhanh” để dựng đơn từ các thuốc đang sắp hết, hoặc “Nhập thủ công” để tự chọn."
        />
      )}

      {pending.length > 0 && (
        <section className="mb-6">
          <h2 className="font-semibold text-ink mb-2">Đang chờ xử lý ({pending.length})</h2>
          <div className="space-y-3">
            {pending.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                onExport={() => apiDownload(`/api/doctor/stock-orders/${o.id}/export`, `${o.code}.xlsx`)}
                onReceive={() => setReceiving(o)}
                onCancel={() => setCancelling(o)}
              />
            ))}
          </div>
        </section>
      )}

      {done.length > 0 && (
        <section>
          <h2 className="font-semibold text-ink mb-2">Đã xử lý</h2>
          <div className="space-y-3">
            {done.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                onExport={() => apiDownload(`/api/doctor/stock-orders/${o.id}/export`, `${o.code}.xlsx`)}
              />
            ))}
          </div>
        </section>
      )}

      <ConfirmDialog
        open={!!receiving}
        title="Bạn có chắc đã nhập đủ thuốc và số lượng theo đơn chưa?"
        message={
          <>
            Đơn <strong>{receiving?.code}</strong> gồm {receiving?.items.length} dòng thuốc. Xác nhận
            sẽ <strong>cộng ngay số lượng này vào tồn kho</strong> và không hoàn tác được. Nếu nhận
            thiếu, hãy hủy đơn rồi chỉnh tồn bằng nút “Nhập / chỉnh” trong Kho thuốc.
          </>
        }
        confirmLabel="Xác nhận nhập thuốc"
        tone="primary"
        onConfirm={() => receive(receiving!)}
        onClose={() => setReceiving(null)}
      />

      <ConfirmDialog
        open={!!cancelling}
        title={`Hủy đơn ${cancelling?.code}?`}
        message="Đơn sẽ chuyển sang trạng thái đã hủy. Tồn kho không thay đổi vì đơn chưa từng được cộng."
        confirmLabel="Hủy đơn"
        onConfirm={() => cancel(cancelling!)}
        onClose={() => setCancelling(null)}
      />
    </div>
  );
}

/* ===================== Đơn đang soạn ===================== */

function DraftCard({
  mode, lines, note, busy, error,
  onNote, onUpdateLine, onRemoveLine, onAddLine, onExport, onCancel,
}: {
  mode: "QUICK" | "MANUAL";
  lines: DraftLine[];
  note: string;
  busy: boolean;
  error: string;
  onNote: (v: string) => void;
  onUpdateLine: (i: number, patch: Partial<DraftLine>) => void;
  onRemoveLine: (i: number) => void;
  onAddLine: (m: Medicine) => void;
  onExport: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="card p-5 mb-6">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
        <p className="font-semibold text-ink">
          {mode === "QUICK" ? "Đơn nhập nhanh — thuốc đang sắp hết" : "Đơn nhập thủ công"}
        </p>
        <span className="text-sm text-gray-500">{lines.length} dòng thuốc</span>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        {mode === "QUICK"
          ? "Mặc định 1 đơn vị lớn nhất cho mỗi thuốc — chỉnh lại số lượng và đơn vị nếu cần."
          : "Tìm thuốc trong kho rồi thêm vào đơn."}
      </p>

      {mode === "MANUAL" && <MedicineSearch onPick={onAddLine} />}

      {lines.length > 0 && (
        <div className="overflow-x-auto mt-4">
          <table className="data-table">
            <thead>
              <tr>
                <th>Thuốc</th>
                <th className="w-40">Tồn hiện tại</th>
                <th className="w-32">Số lượng</th>
                <th className="w-36">Đơn vị</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={l.medicineId}>
                  <td className="font-medium text-ink">{l.medicineName}</td>
                  <td className="text-gray-500">{l.stockDisplay ?? "—"}</td>
                  <td>
                    <input
                      type="number" min={0} step="any"
                      value={l.qty}
                      onChange={(e) => onUpdateLine(i, { qty: e.target.value })}
                      className="input-sm w-24"
                    />
                  </td>
                  <td>
                    <select
                      value={l.unitName}
                      onChange={(e) => onUpdateLine(i, { unitName: e.target.value })}
                      className="input-sm w-28"
                    >
                      {l.units.map((u) => (
                        <option key={u.unitName} value={u.unitName}>{u.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="text-right">
                    <button
                      onClick={() => onRemoveLine(i)}
                      className="text-gray-400 hover:text-red-600"
                      aria-label="Bỏ dòng này"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {lines.length === 0 && mode === "MANUAL" && (
        <p className="text-sm text-gray-500 mt-4">Chưa có thuốc nào trong đơn.</p>
      )}

      <input
        value={note}
        onChange={(e) => onNote(e.target.value)}
        placeholder="Ghi chú cho nhà thuốc (tùy chọn): giao trước thứ 6, ưu tiên hàng cận date..."
        className="input mt-4"
      />

      {error && <p className="text-red-600 text-sm mt-3">{error}</p>}

      <div className="flex gap-2 mt-4">
        <button onClick={onExport} disabled={busy} className="btn-primary">
          {busy ? "Đang xuất..." : "Xuất file"}
        </button>
        <button onClick={onCancel} disabled={busy} className="btn-ghost">Hủy</button>
      </div>
    </div>
  );
}

/* ===================== Tìm thuốc (nhập thủ công) ===================== */

function MedicineSearch({ onPick }: { onPick: (m: Medicine) => void }) {
  const [q, setQ] = useState("");
  const [options, setOptions] = useState<Medicine[]>([]);

  useEffect(() => {
    const kw = q.trim();
    if (!kw) { setOptions([]); return; }
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      api<Page<Medicine>>(`/api/doctor/medicines?q=${encodeURIComponent(kw)}&size=8`)
        .then((p) => setOptions(p.content))
        .catch(() => {});
    }, 250);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [q]);

  return (
    <div>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          <IconSearch size={16} />
        </span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Gõ tên thuốc để thêm vào đơn..."
          className="input pl-9"
        />
      </div>
      {options.length > 0 && (
        <div className="border border-gray-200 rounded-lg mt-2 divide-y max-h-56 overflow-y-auto">
          {options.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => { onPick(m); setQ(""); setOptions([]); }}
              className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm flex items-center justify-between gap-3"
            >
              <span className="font-medium text-ink">{m.name}</span>
              <span className="text-xs text-gray-500">
                tồn {m.stockDisplay}
                {m.lowStock && <span className="text-red-600 font-medium"> · sắp hết</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ===================== Thẻ một đơn ===================== */

function OrderCard({
  order, onExport, onReceive, onCancel,
}: {
  order: StockOrder;
  onExport: () => void;
  onReceive?: () => void;
  onCancel?: () => void;
}) {
  const tone = order.status === "PENDING" ? "amber" : order.status === "RECEIVED" ? "blue" : "red";
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-ink">{order.code}</span>
          <Badge tone={tone}>{STOCK_ORDER_STATUS_LABEL[order.status]}</Badge>
          <span className="text-xs text-gray-500">
            {new Date(order.createdAt).toLocaleString("vi-VN", {
              hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric",
            })}
            {order.source === "QUICK" && " · nhập nhanh"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onExport} className="text-sm font-medium text-blue-700 hover:underline">
            Tải file
          </button>
          {onReceive && (
            <button onClick={onReceive} className="btn-primary py-1.5 px-3 text-sm">
              Xác nhận nhập thuốc
            </button>
          )}
          {onCancel && (
            <button onClick={onCancel} className="text-sm font-medium text-red-600 hover:underline">
              Hủy
            </button>
          )}
        </div>
      </div>

      <ul className="divide-y divide-gray-100">
        {order.items.map((it, i) => (
          <li key={i} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <span className="font-medium text-ink">{it.medicineName}</span>
            <span className="text-gray-600">
              {it.qty} {it.unitLabel}
              {it.currentStockDisplay && (
                <span className="text-gray-400"> · tồn {it.currentStockDisplay}</span>
              )}
            </span>
          </li>
        ))}
      </ul>

      {order.note && (
        <p className="px-4 py-2 text-xs text-gray-500 border-t border-gray-100">
          Ghi chú: {order.note}
        </p>
      )}
    </div>
  );
}
