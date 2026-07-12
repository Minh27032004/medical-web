"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { UNIT_OPTIONS, type Medicine, type Page } from "@/lib/types";

interface UnitRow {
  unitName: string;
  factorToNext: string; // số đơn-vị-cấp-dưới trong 1 đơn vị này (đơn vị cuối = base, bỏ trống)
}

const emptyForm = () => ({
  name: "",
  injection: false,
  lowStockThreshold: "30",
  units: [
    { unitName: "hop", factorToNext: "" },
    { unitName: "vi", factorToNext: "" },
    { unitName: "vien", factorToNext: "" },
  ] as UnitRow[],
});

export default function InventoryPage() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [adjustFor, setAdjustFor] = useState<Medicine | null>(null);

  const load = useCallback(() => {
    api<Page<Medicine>>(`/api/doctor/medicines?q=${encodeURIComponent(q)}&size=100`)
      .then((p) => setItems(p.content))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [q]);

  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [load]);

  function updateUnit(idx: number, patch: Partial<UnitRow>) {
    setForm((f) => ({ ...f, units: f.units.map((u, i) => (i === idx ? { ...u, ...patch } : u)) }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const body = {
      name: form.name,
      injection: form.injection,
      lowStockThreshold: Number(form.lowStockThreshold) || 30,
      units: form.injection
        ? []
        : form.units
            .filter((u) => u.unitName)
            .map((u, i, arr) => ({
              unitName: u.unitName,
              factorToNext: i === arr.length - 1 ? null : Number(u.factorToNext) || null,
            })),
    };
    try {
      await api("/api/doctor/medicines", { method: "POST", body: JSON.stringify(body) });
      setShowForm(false);
      setForm(emptyForm());
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  }

  async function remove(m: Medicine) {
    if (!confirm(`Xóa "${m.name}" khỏi kho?`)) return;
    await api(`/api/doctor/medicines/${m.id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h1 className="text-xl font-bold">Kho thuốc</h1>
        <div className="flex gap-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm thuốc..."
            className="border rounded-lg px-3 py-2 w-56 text-sm"
          />
          <button
            onClick={() => { setShowForm(!showForm); setForm(emptyForm()); }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 shrink-0"
          >
            + Thêm thuốc
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={save} className="bg-white border rounded-xl p-5 mb-4 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1 font-medium">Tên thuốc *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm mb-1 font-medium">Ngưỡng cảnh báo (đơn vị nhỏ nhất)</label>
              <input
                type="number" min={0}
                value={form.lowStockThreshold}
                onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.injection}
              onChange={(e) => setForm({ ...form, injection: e.target.checked })}
            />
            💉 Thuốc tiêm (chỉ dùng đơn vị "ống", không quy đổi)
          </label>

          {!form.injection && (
            <div className="border rounded-lg p-3 bg-gray-50">
              <p className="text-sm font-medium mb-2">
                Đơn vị & quy đổi <span className="text-gray-500 font-normal">(lớn → nhỏ; đơn vị cuối là đơn vị nhỏ nhất)</span>
              </p>
              <div className="space-y-2">
                {form.units.map((u, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <select
                      value={u.unitName}
                      onChange={(e) => updateUnit(idx, { unitName: e.target.value })}
                      className="border rounded-lg px-2 py-1.5"
                    >
                      <option value="">—</option>
                      {UNIT_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    {idx < form.units.length - 1 ? (
                      <>
                        <span>= chứa</span>
                        <input
                          type="number" min={1}
                          value={u.factorToNext}
                          onChange={(e) => updateUnit(idx, { factorToNext: e.target.value })}
                          className="w-20 border rounded-lg px-2 py-1.5"
                          placeholder="số"
                          required
                        />
                        <span className="text-gray-500">{UNIT_OPTIONS.find((o) => o.value === form.units[idx + 1]?.unitName)?.label ?? "đơn vị dưới"}</span>
                      </>
                    ) : (
                      <span className="text-blue-700 text-xs">← đơn vị nhỏ nhất (tồn kho tính theo đơn vị này)</span>
                    )}
                    {form.units.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, units: form.units.filter((_, i) => i !== idx) })}
                        className="text-red-600 ml-auto"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setForm({ ...form, units: [...form.units, { unitName: "", factorToNext: "" }] })}
                className="mt-2 text-sm text-blue-700 hover:underline"
              >
                + Thêm cấp đơn vị
              </button>
              <p className="text-xs text-gray-500 mt-2">
                VD Paracetamol: hộp = chứa 5 vĩ, vĩ = chứa 10 viên, viên (nhỏ nhất). Tồn kho sẽ tính theo viên.
              </p>
            </div>
          )}

          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Đang lưu..." : "Lưu thuốc"}
          </button>
        </form>
      )}

      {loading && <p className="text-gray-500 py-8 text-center">Đang tải...</p>}
      {!loading && items.length === 0 && !showForm && (
        <p className="text-gray-500 py-8 text-center">Kho trống — bấm &quot;+ Thêm thuốc&quot;.</p>
      )}

      {items.length > 0 && (
        <div className="bg-white border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="p-3">Thuốc</th>
                <th className="p-3">Tồn kho</th>
                <th className="p-3">Đơn vị</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((m) => (
                <tr key={m.id} className={m.lowStock ? "bg-red-50/50" : ""}>
                  <td className="p-3">
                    <span className="font-medium">{m.injection && "💉 "}{m.name}</span>
                    {m.lowStock && <span className="ml-2 text-xs text-red-600 font-medium">⚠ sắp hết</span>}
                  </td>
                  <td className="p-3">
                    {m.stockDisplay}
                    <span className="text-xs text-gray-400 ml-1">({m.stockBaseQty} {m.baseUnitLabel})</span>
                  </td>
                  <td className="p-3 text-gray-500 text-xs">
                    {m.units.map((u) => u.label).join(" › ")}
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <button onClick={() => setAdjustFor(m)} className="text-blue-700 hover:underline mr-3">
                      Nhập / chỉnh
                    </button>
                    <button onClick={() => remove(m)} className="text-red-600 hover:underline">
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adjustFor && (
        <AdjustModal
          medicine={adjustFor}
          onClose={() => setAdjustFor(null)}
          onDone={() => { setAdjustFor(null); load(); }}
        />
      )}
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
      <div className="bg-white rounded-2xl p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold mb-1">Nhập kho / chỉnh tồn</h3>
        <p className="text-sm text-gray-600 mb-3">{medicine.name} — tồn: {medicine.stockDisplay}</p>
        <p className="text-xs text-gray-500 mb-2">Nhập số dương để cộng, số âm để trừ (VD -1 hộp khi bỏ thuốc hết hạn).</p>
        <div className="space-y-2">
          {medicine.units.map((u) => (
            <div key={u.unitName} className="flex items-center gap-3">
              <input
                type="number" step="any"
                value={entries[u.unitName] ?? ""}
                onChange={(e) => setEntries({ ...entries, [u.unitName]: e.target.value })}
                className="w-24 border rounded-lg px-2 py-1.5 text-sm"
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
          className="w-full border rounded-lg px-3 py-2 text-sm mt-3"
        />
        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
        <div className="flex gap-2 mt-4">
          <button onClick={submit} disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Đang lưu..." : "Cập nhật tồn"}
          </button>
          <button onClick={onClose} className="border px-4 py-2 rounded-lg text-sm">Hủy</button>
        </div>
      </div>
    </div>
  );
}
