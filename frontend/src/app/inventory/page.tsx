"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import Pager from "@/components/Pager";
import { Badge, EmptyState, IconAlert, IconDroplet, IconPill, IconPlus, IconSyringe, LoadError, Loading } from "@/components/ui";
import { useApiData } from "@/hooks/useApiData";
import { useDebounced } from "@/hooks/useDebounced";
import { api, ApiError } from "@/lib/api";
import { type Medicine, type Page } from "@/lib/types";

const PAGE_SIZE = 10;
type StockFilter = "all" | "oral" | "injection" | "infusion" | "low";

export default function InventoryPage() {
  const [q, setQ] = useState("");
  const [adjustFor, setAdjustFor] = useState<Medicine | null>(null);
  const [deleting, setDeleting] = useState<Medicine | null>(null); // thuốc chờ xác nhận xóa
  const [filter, setFilter] = useState<StockFilter>("all");
  const [page, setPage] = useState(0);

  // Chỉ trễ khi GÕ tìm kiếm; lần vào trang tải NGAY.
  const dq = useDebounced(q, 300);

  // size lớn vì lọc uống/tiêm/truyền dịch + phân trang đều chạy client-side trên danh sách này.
  const { data, loading, failed: loadFailed, reload: load } = useApiData<Page<Medicine>>(
    `/api/doctor/medicines?q=${encodeURIComponent(dq)}&size=500`
  );
  // useMemo: `?? []` tạo mảng mới mỗi lần render, làm hai useMemo bên dưới tính lại vô ích.
  const items = useMemo(() => data?.content ?? [], [data]);

  // Lọc uống/tiêm + phân trang client-side; đổi điều kiện → về trang đầu.
  const filtered = useMemo(() => items.filter((m) => {
    if (filter === "oral") return !m.injection && !m.infusion;
    if (filter === "injection") return m.injection;
    if (filter === "infusion") return m.infusion;
    if (filter === "low") return m.lowStock; // tồn < ngưỡng cảnh báo, do backend tính
    return true;
  }), [items, filter]);

  // Đếm để hiện ngay trên chip — bác sĩ thấy có bao nhiêu thuốc cần nhập mà không phải bấm vào.
  const lowCount = useMemo(() => items.filter((m) => m.lowStock).length, [items]);

  useEffect(() => setPage(0), [q, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  async function remove(m: Medicine) {
    await api(`/api/doctor/medicines/${m.id}`, { method: "DELETE" });
    load();
  }

  // Xem trước tổng quy đổi để bác sĩ yên tâm
  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h1 className="page-title">Kho thuốc</h1>
        <div className="flex gap-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm thuốc..."
            className="input w-56"
          />
          <Link href="/inventory/new" className="btn-primary shrink-0">
            <IconPlus />
            Thêm thuốc
          </Link>
        </div>
      </div>

      <div className="flex gap-2 mb-4 text-sm flex-wrap">
        {([["all", "Tất cả", null], ["oral", "Uống", <IconPill key="o" size={14} />], ["injection", "Tiêm", <IconSyringe key="i" size={14} />], ["infusion", "Truyền dịch", <IconDroplet key="f" size={14} />]] as const).map(([v, label, icon]) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            className={`chip inline-flex items-center gap-1.5 ${filter === v ? "chip-active" : ""}`}
          >
            {icon}
            {label}
          </button>
        ))}

        {/* Sắp hết: tách khỏi nhóm lọc theo loại, tô đỏ vì đây là việc cần XỬ LÝ chứ
            không phải một cách xem khác. Kèm số lượng để khỏi phải bấm vào mới biết. */}
        <button
          onClick={() => setFilter("low")}
          className={`chip inline-flex items-center gap-1.5 ml-1 ${
            filter === "low"
              ? "bg-red-600 text-white border-red-600 hover:bg-red-600"
              : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
          }`}
        >
          <IconAlert size={14} />
          Sắp hết
          {lowCount > 0 && (
            <span
              className={`ml-0.5 rounded-full px-1.5 text-xs font-semibold ${
                filter === "low" ? "bg-white/25" : "bg-red-600 text-white"
              }`}
            >
              {lowCount}
            </span>
          )}
        </button>
      </div>

      {loading && <Loading />}
      {!loading && loadFailed && <LoadError onRetry={load} />}
      {!loading && !loadFailed && filtered.length === 0 && (
        <EmptyState
          icon={<IconPill size={22} />}
          action={
            items.length === 0 && (
              <Link href="/inventory/new" className="btn-primary">
                <IconPlus />
                Thêm thuốc
              </Link>
            )
          }
          title={
            items.length === 0
              ? "Kho thuốc trống"
              : filter === "low"
              ? "Không có thuốc nào sắp hết"
              : "Không có thuốc khớp bộ lọc"
          }
          hint={
            items.length === 0
              ? "Thêm thuốc đầu tiên để quản lý tồn kho và trừ kho khi kê đơn."
              : filter === "low"
              ? "Mọi thuốc đều còn trên ngưỡng cảnh báo. Ngưỡng chỉnh được khi sửa từng thuốc."
              : "Thử đổi từ khóa hoặc bộ lọc uống/tiêm/truyền dịch."
          }
        />
      )}

      {filtered.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Thuốc</th>
                  <th>Tồn kho</th>
                  <th>Đơn vị</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((m) => (
                  <tr key={m.id} className={m.lowStock ? "bg-red-50/50" : ""}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden shrink-0 relative">
                          {m.imageUrl ? (
                            <Image src={m.imageUrl} alt="" fill sizes="40px" className="object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                              {m.injection ? <IconSyringe size={18} /> : m.infusion ? <IconDroplet size={18} /> : <IconPill size={18} />}
                            </div>
                          )}
                        </div>
                        <span className="font-semibold text-ink">{m.name}</span>
                        {m.lowStock && <Badge tone="red" icon={<IconAlert size={13} />}>sắp hết</Badge>}
                      </div>
                    </td>
                    <td>
                      {m.stockDisplay}
                      <span className="text-xs text-gray-400 ml-1">({m.stockBaseQty} {m.baseUnitLabel})</span>
                    </td>
                    <td className="text-gray-500 text-xs">{m.units.map((u) => u.label).join(" › ")}</td>
                    <td className="text-right whitespace-nowrap">
                      <Link href={`/inventory/${m.id}`} className="font-medium text-blue-700 hover:underline mr-3">Sửa</Link>
                      <button onClick={() => setAdjustFor(m)} className="font-medium text-blue-700 hover:underline mr-3">Nhập / chỉnh</button>
                      <button onClick={() => setDeleting(m)} className="font-medium text-red-600 hover:underline">Xóa</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Pager page={page} totalPages={totalPages} onPage={setPage} />

      {adjustFor && (
        <AdjustModal
          medicine={adjustFor}
          onClose={() => setAdjustFor(null)}
          onDone={() => { setAdjustFor(null); load(); }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title={`Xóa "${deleting?.name}" khỏi kho?`}
        message={
          <>
            Tồn hiện tại <strong>{deleting?.stockDisplay}</strong> sẽ không còn hiện trong kho.
            Đơn thuốc đã kê trước đó giữ nguyên vì đã lưu snapshot tên và đơn vị.
          </>
        }
        onConfirm={() => remove(deleting!)}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

/** Nhập kho / chỉnh tay: nhập theo đơn vị bất kỳ, hỗn hợp (âm = trừ). */
function AdjustModal({ medicine, onClose, onDone }: { medicine: Medicine; onClose: () => void; onDone: () => void }) {
  const [entries, setEntries] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    const list = medicine.units
      .filter((u) => entries[u.unitName] && Number(entries[u.unitName]) !== 0)
      .map((u) => ({ unitName: u.unitName, qty: Number(entries[u.unitName]) }));
    if (list.length === 0) {
      setError("Nhập số lượng ít nhất 1 đơn vị");
      return;
    }
    setSaving(true);
    try {
      await api(`/api/doctor/medicines/${medicine.id}/adjust-stock`, {
        method: "POST",
        body: JSON.stringify({ entries: list, reason: reason || null }),
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Lỗi");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold mb-1 text-ink">Nhập kho / chỉnh tồn</h3>
        <p className="text-sm text-gray-600 mb-3">{medicine.name} — tồn: {medicine.stockDisplay}</p>
        <p className="text-xs text-gray-500 mb-2">Nhập số dương để cộng, số âm để trừ (VD -1 hộp khi bỏ thuốc hết hạn).</p>
        <div className="space-y-2">
          {medicine.units.map((u) => (
            <div key={u.unitName} className="flex items-center gap-3">
              <input
                type="number" step="any"
                value={entries[u.unitName] ?? ""}
                onChange={(e) => setEntries({ ...entries, [u.unitName]: e.target.value })}
                className="input-sm w-24"
                placeholder="0"
              />
              <span className="text-sm">{u.label}</span>
            </div>
          ))}
        </div>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Lý do (tùy chọn): nhập hàng, kiểm kê, hết hạn..."
          className="input mt-3"
        />
        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
        <div className="flex gap-2 mt-4">
          <button onClick={submit} disabled={saving} className="btn-primary">
            {saving ? "Đang lưu..." : "Cập nhật tồn"}
          </button>
          <button onClick={onClose} className="btn-ghost">Hủy</button>
        </div>
      </div>
    </div>
  );
}
