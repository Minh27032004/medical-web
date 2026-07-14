"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import Pager from "@/components/Pager";
import { api, apiForm, ApiError } from "@/lib/api";
import { UNIT_LABEL, UNIT_OPTIONS, type Medicine, type Page } from "@/lib/types";

const PAGE_SIZE = 10;
type StockFilter = "all" | "oral" | "injection";

/** Đơn vị theo thứ tự lớn → nhỏ (§6.1). Người dùng tick, không cần đúng thứ tự khi bấm. */
const HIERARCHY = UNIT_OPTIONS.map((u) => u.value); // [chai, hop, vi, vien, goi]

interface FormState {
  name: string;
  injection: boolean;
  lowStockThreshold: string;
  imagePath: string | null;
  imageUrl: string | null;
  ticked: string[]; // đơn vị đã tick (đã sắp theo HIERARCHY)
  values: Record<string, string>; // số nhập cho mỗi đơn vị (lớn nhất = tồn, còn lại = tỷ lệ)
  injectionStock: string; // số ống cho thuốc tiêm
}

const emptyForm = (): FormState => ({
  name: "",
  injection: false,
  lowStockThreshold: "30",
  imagePath: null,
  imageUrl: null,
  ticked: [],
  values: {},
  injectionStock: "",
});

/** Dựng lại payload đơn vị (factorToNext) từ 1 thuốc đã có — để PUT cập nhật mà GIỮ NGUYÊN cấu trúc kho. */
function unitsPayload(m: Medicine) {
  if (m.injection) return [];
  return m.units.map((u, i) => ({
    unitName: u.unitName,
    factorToNext:
      i < m.units.length - 1
        ? Number(m.units[i].factorToBase) / Number(m.units[i + 1].factorToBase)
        : null,
  }));
}

export default function InventoryPage() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [adjustFor, setAdjustFor] = useState<Medicine | null>(null);
  const [editing, setEditing] = useState<Medicine | null>(null); // thuốc đang sửa (null = đang thêm mới)
  const [filter, setFilter] = useState<StockFilter>("all");
  const [page, setPage] = useState(0);

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

  // Lọc uống/tiêm + phân trang client-side; đổi điều kiện → về trang đầu.
  const filtered = useMemo(() => items.filter((m) => {
    if (filter === "oral") return !m.injection;
    if (filter === "injection") return m.injection;
    return true;
  }), [items, filter]);

  useEffect(() => setPage(0), [q, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  function toggleUnit(unit: string) {
    setForm((f) => {
      const has = f.ticked.includes(unit);
      const ticked = has
        ? f.ticked.filter((u) => u !== unit)
        : HIERARCHY.filter((u) => u === unit || f.ticked.includes(u)); // giữ đúng thứ tự lớn→nhỏ
      return { ...f, ticked };
    });
  }

  async function uploadImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiForm<{ path: string; url: string }>("/api/doctor/uploads/medicine-image", fd);
      setForm((f) => ({ ...f, imagePath: res.path, imageUrl: res.url }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload ảnh thất bại");
    } finally {
      setUploading(false);
    }
  }

  /** Mở form ở chế độ SỬA — pre-fill từ thuốc; đơn vị & loại khóa lại (bảo toàn tồn kho). */
  function startEdit(m: Medicine) {
    setEditing(m);
    setForm({
      name: m.name,
      injection: m.injection,
      lowStockThreshold: String(m.lowStockThreshold),
      imagePath: m.imagePath,
      imageUrl: m.imageUrl,
      ticked: m.units.map((u) => u.unitName),
      values: {},
      injectionStock: "",
    });
    setError("");
    setShowForm(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // Sửa: chỉ đổi tên/ngưỡng/ảnh; giữ nguyên đơn vị & loại (gửi lại cấu trúc cũ). Không đụng tồn kho.
    if (editing) {
      setSaving(true);
      try {
        await api(`/api/doctor/medicines/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify({
            name: form.name,
            injection: editing.injection,
            lowStockThreshold: Number(form.lowStockThreshold) || 30,
            units: unitsPayload(editing),
            imagePath: form.imagePath,
          }),
        });
        setShowForm(false);
        setEditing(null);
        setForm(emptyForm());
        load();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Lưu thất bại");
      } finally {
        setSaving(false);
      }
      return;
    }

    let body: Record<string, unknown>;
    if (form.injection) {
      body = {
        name: form.name,
        injection: true,
        lowStockThreshold: Number(form.lowStockThreshold) || 30,
        units: [],
        imagePath: form.imagePath,
        initialStockUnit: "ong",
        initialStockQty: Number(form.injectionStock) || 0,
      };
    } else {
      if (form.ticked.length === 0) {
        setError("Tick ít nhất 1 đơn vị");
        return;
      }
      // Mỗi đơn vị nhỏ hơn: số nhập = "bao nhiêu đơn vị này trong 1 đơn vị cha" = factorToNext của CHA.
      // Đơn vị lớn nhất: số nhập = số lượng tồn ban đầu.
      const units = form.ticked.map((u, i) => ({
        unitName: u,
        // factorToNext của u = số của đơn-vị-con (u kế tiếp). Đơn vị nhỏ nhất → null.
        factorToNext: i < form.ticked.length - 1 ? Number(form.values[form.ticked[i + 1]]) || null : null,
      }));
      const largest = form.ticked[0];
      body = {
        name: form.name,
        injection: false,
        lowStockThreshold: Number(form.lowStockThreshold) || 30,
        units,
        imagePath: form.imagePath,
        initialStockUnit: largest,
        initialStockQty: Number(form.values[largest]) || 0,
      };
    }

    setSaving(true);
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

  // Xem trước tổng quy đổi để bác sĩ yên tâm
  function previewTotal(): string {
    if (form.injection || form.ticked.length === 0) return "";
    // factorToBase từng đơn vị
    const factors: Record<string, number> = {};
    const rev = [...form.ticked].reverse();
    let acc = 1;
    factors[rev[0]] = 1;
    for (let i = 1; i < rev.length; i++) {
      acc *= Number(form.values[rev[i - 1]]) || 0; // số con trong cha (nằm ở row con = rev[i-1])
      factors[rev[i]] = acc;
    }
    const largest = form.ticked[0];
    const qty = Number(form.values[largest]) || 0;
    const totalBase = qty * (factors[largest] || 0);
    if (!totalBase) return "";
    const base = form.ticked[form.ticked.length - 1];
    return `= ${totalBase} ${UNIT_LABEL[base]}`;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-[#1b2559]">Kho thuốc</h1>
        <div className="flex gap-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm thuốc..."
            className="input w-56"
          />
          <button
            onClick={() => { const wasEditing = editing; setEditing(null); setForm(emptyForm()); setShowForm(wasEditing ? true : !showForm); }}
            className="btn-primary shrink-0"
          >
            + Thêm thuốc
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-4 text-sm">
        {([["all", "Tất cả"], ["oral", "💊 Uống"], ["injection", "💉 Tiêm"]] as const).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            className={`chip ${filter === v ? "chip-active" : ""}`}
          >
            {label}
          </button>
        ))}
      </div>

      {showForm && (
        <form onSubmit={save} className="card p-5 mb-4 space-y-4">
          <p className="font-semibold text-[#1b2559]">{editing ? `Sửa thuốc: ${editing.name}` : "Thêm thuốc mới"}</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1 font-medium">Tên thuốc *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input"
                required
              />
            </div>
            <div>
              <label className="block text-sm mb-1 font-medium">Ngưỡng cảnh báo (đơn vị nhỏ nhất)</label>
              <input
                type="number" min={0}
                value={form.lowStockThreshold}
                onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })}
                className="input"
              />
            </div>
          </div>

          {/* Ảnh thuốc */}
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden shrink-0 relative">
              {form.imageUrl ? (
                <Image src={form.imageUrl} alt="" fill className="object-cover" unoptimized />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl">💊</div>
              )}
            </div>
            <label className="text-sm border rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-50">
              {uploading ? "Đang tải..." : "Chọn ảnh thuốc"}
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadImage} className="hidden" disabled={uploading} />
            </label>
          </div>

          {!editing && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.injection}
                onChange={(e) => setForm({ ...form, injection: e.target.checked })}
              />
              💉 Thuốc tiêm (chỉ dùng đơn vị &quot;ống&quot;, không quy đổi)
            </label>
          )}

          {editing ? (
            <div className="border rounded-lg p-3 bg-gray-50 text-sm">
              <p className="font-medium mb-1">
                {editing.injection
                  ? "💉 Thuốc tiêm (đơn vị: ống)"
                  : `Đơn vị: ${editing.units.map((u) => u.label).join(" › ")}`}
              </p>
              <p className="text-xs text-gray-500">
                Không đổi loại/đơn vị ở đây để bảo toàn tồn kho hiện có. Cần chỉnh tồn thì dùng nút &quot;Nhập / chỉnh&quot;.
              </p>
            </div>
          ) : form.injection ? (
            <div className="border rounded-lg p-3 bg-purple-50/40">
              <label className="block text-sm mb-1 font-medium">Số lượng nhập ban đầu (ống)</label>
              <input
                type="number" min={0}
                value={form.injectionStock}
                onChange={(e) => setForm({ ...form, injectionStock: e.target.value })}
                className="w-40 border rounded-lg px-3 py-2"
                placeholder="VD: 50"
              />
            </div>
          ) : (
            <div className="border rounded-lg p-3 bg-gray-50 space-y-3">
              <div>
                <p className="text-sm font-medium mb-2">Đơn vị sử dụng (tick từ lớn đến nhỏ)</p>
                <div className="flex flex-wrap gap-3">
                  {UNIT_OPTIONS.map((u) => (
                    <label key={u.value} className="flex items-center gap-1.5 text-sm border rounded-lg px-3 py-1.5 cursor-pointer hover:bg-white">
                      <input
                        type="checkbox"
                        checked={form.ticked.includes(u.value)}
                        onChange={() => toggleUnit(u.value)}
                      />
                      {u.label}
                    </label>
                  ))}
                </div>
              </div>

              {form.ticked.length > 0 && (
                <div className="space-y-2 pt-1">
                  {form.ticked.map((u, i) => {
                    const isLargest = i === 0;
                    const isSmallest = i === form.ticked.length - 1;
                    const parent = i > 0 ? form.ticked[i - 1] : null;
                    return (
                      <div key={u} className="flex items-center gap-2 text-sm flex-wrap">
                        <span className="w-14 font-medium">{UNIT_LABEL[u]}</span>
                        {isLargest ? (
                          <>
                            <span className="text-gray-600">số lượng nhập:</span>
                            <input
                              type="number" min={0}
                              value={form.values[u] ?? ""}
                              onChange={(e) => setForm({ ...form, values: { ...form.values, [u]: e.target.value } })}
                              className="w-24 border rounded-lg px-2 py-1.5"
                              placeholder="VD 10"
                            />
                            <span className="text-gray-500">{UNIT_LABEL[u]}</span>
                          </>
                        ) : (
                          <>
                            <span className="text-gray-600">1 {UNIT_LABEL[parent!]} chứa</span>
                            <input
                              type="number" min={1}
                              value={form.values[u] ?? ""}
                              onChange={(e) => setForm({ ...form, values: { ...form.values, [u]: e.target.value } })}
                              className="w-24 border rounded-lg px-2 py-1.5"
                              placeholder="số"
                              required
                            />
                            <span className="text-gray-500">{UNIT_LABEL[u]}</span>
                          </>
                        )}
                        {isSmallest && (
                          <span className="text-blue-700 text-xs ml-1">← đơn vị nhỏ nhất (tồn kho tính theo đơn vị này)</span>
                        )}
                      </div>
                    );
                  })}
                  {previewTotal() && (
                    <p className="text-sm text-blue-700 font-medium pt-1">Tồn ban đầu {previewTotal()}</p>
                  )}
                </div>
              )}
              <p className="text-xs text-gray-500">
                VD: tick hộp, vĩ, viên → nhập 10 hộp, 1 hộp chứa 7 vĩ, 1 vĩ chứa 10 viên = 700 viên.
                Cảnh báo khi tồn dưới ngưỡng (viên).
              </p>
            </div>
          )}

          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button type="submit" disabled={saving || uploading} className="btn-primary">
            {saving ? "Đang lưu..." : editing ? "Cập nhật thuốc" : "Lưu thuốc"}
          </button>
        </form>
      )}

      {loading && <p className="text-gray-500 py-8 text-center">Đang tải...</p>}
      {!loading && filtered.length === 0 && !showForm && (
        <p className="text-gray-500 py-8 text-center">
          {items.length === 0 ? "Kho trống — bấm \"+ Thêm thuốc\"." : "Không có thuốc khớp bộ lọc."}
        </p>
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
                            <Image src={m.imageUrl} alt="" fill className="object-cover" unoptimized />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">{m.injection ? "💉" : "💊"}</div>
                          )}
                        </div>
                        <span className="font-semibold text-[#1b2559]">{m.name}</span>
                        {m.lowStock && <span className="text-xs text-red-600 font-medium">⚠ sắp hết</span>}
                      </div>
                    </td>
                    <td>
                      {m.stockDisplay}
                      <span className="text-xs text-gray-400 ml-1">({m.stockBaseQty} {m.baseUnitLabel})</span>
                    </td>
                    <td className="text-gray-500 text-xs">{m.units.map((u) => u.label).join(" › ")}</td>
                    <td className="text-right whitespace-nowrap">
                      <button onClick={() => startEdit(m)} className="font-medium text-blue-700 hover:underline mr-3">Sửa</button>
                      <button onClick={() => setAdjustFor(m)} className="font-medium text-blue-700 hover:underline mr-3">Nhập / chỉnh</button>
                      <button onClick={() => remove(m)} className="font-medium text-red-600 hover:underline">Xóa</button>
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
        <h3 className="font-bold mb-1 text-[#1b2559]">Nhập kho / chỉnh tồn</h3>
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
