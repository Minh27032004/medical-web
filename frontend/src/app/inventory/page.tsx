"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import Pager from "@/components/Pager";
import { Badge, EmptyState, IconAlert, IconDroplet, IconPill, IconPlus, IconSyringe, LoadError, Loading } from "@/components/ui";
import { useApiData } from "@/hooks/useApiData";
import { useDebounced } from "@/hooks/useDebounced";
import { api, apiForm, ApiError } from "@/lib/api";
import { UNIT_LABEL, UNIT_OPTIONS, type Medicine, type Page } from "@/lib/types";

const PAGE_SIZE = 10;
type StockFilter = "all" | "oral" | "injection" | "infusion" | "low";

/** Đơn vị theo thứ tự lớn → nhỏ (§6.1). Người dùng tick, không cần đúng thứ tự khi bấm. */
const HIERARCHY = UNIT_OPTIONS.map((u) => u.value); // [chai, hop, vi, vien, goi]

interface FormState {
  name: string;
  injection: boolean;
  infusion: boolean;
  lowStockThreshold: string;
  imagePath: string | null;
  imageUrl: string | null;
  ticked: string[]; // đơn vị đã tick (đã sắp theo HIERARCHY)
  values: Record<string, string>; // số nhập cho mỗi đơn vị (lớn nhất = tồn, còn lại = tỷ lệ)
  injectionStock: string; // số ống cho thuốc tiêm
  infusionStock: string; // số chai cho truyền dịch
}

const emptyForm = (): FormState => ({
  name: "",
  injection: false,
  infusion: false,
  lowStockThreshold: "30",
  imagePath: null,
  imageUrl: null,
  ticked: [],
  values: {},
  injectionStock: "",
  infusionStock: "",
});

/**
 * "Chữ ký" cấu trúc kho = loại thuốc + danh sách đơn vị + tỷ lệ quy đổi.
 * Đổi chữ ký ⇒ base_unit hoặc factor đổi ⇒ tồn cũ vô nghĩa ⇒ bắt nhập lại tồn (resetStock).
 */
function unitSig(f: Pick<FormState, "injection" | "infusion" | "ticked" | "values">): string {
  if (f.injection) return "inj";
  if (f.infusion) return "inf";
  // tỷ lệ nằm ở các đơn vị NHỎ HƠN đơn vị lớn nhất ("1 cha chứa N con")
  return f.ticked.join(">") + "#" + f.ticked.slice(1).map((u) => f.values[u] ?? "").join(",");
}

/** Tỷ lệ quy đổi hiện có của 1 thuốc → dạng values của form ("1 cha chứa N con"). */
function ratiosOf(m: Medicine): Record<string, string> {
  const values: Record<string, string> = {};
  for (let i = 1; i < m.units.length; i++) {
    values[m.units[i].unitName] = String(
      Number(m.units[i - 1].factorToBase) / Number(m.units[i].factorToBase)
    );
  }
  return values;
}

export default function InventoryPage() {
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [adjustFor, setAdjustFor] = useState<Medicine | null>(null);
  const [deleting, setDeleting] = useState<Medicine | null>(null); // thuốc chờ xác nhận xóa
  const [editing, setEditing] = useState<Medicine | null>(null); // thuốc đang sửa (null = đang thêm mới)
  const [origSig, setOrigSig] = useState(""); // chữ ký cấu trúc kho lúc mở form sửa
  const [filter, setFilter] = useState<StockFilter>("all");
  const [page, setPage] = useState(0);

  // Chỉ trễ khi GÕ tìm kiếm; lần vào trang tải NGAY.
  const dq = useDebounced(q, 300);

  // size lớn vì lọc uống/tiêm/truyền dịch + phân trang đều chạy client-side trên danh sách này.
  const { data, loading, failed: loadFailed, reload: load } = useApiData<Page<Medicine>>(
    `/api/doctor/medicines?q=${encodeURIComponent(dq)}&size=500`
  );
  const items = data?.content ?? [];

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

  /**
   * Mở form ở chế độ SỬA — dùng CHUNG form với thêm mới: đơn vị & loại đều sửa được.
   * Ô "số lượng" để TRỐNG = giữ nguyên tồn hiện có; đổi cấu trúc thì bắt buộc nhập lại.
   */
  function startEdit(m: Medicine) {
    const next: FormState = {
      name: m.name,
      injection: m.injection,
      infusion: m.infusion,
      lowStockThreshold: String(m.lowStockThreshold),
      imagePath: m.imagePath,
      imageUrl: m.imageUrl,
      ticked: m.injection || m.infusion ? [] : m.units.map((u) => u.unitName),
      values: m.injection || m.infusion ? {} : ratiosOf(m),
      injectionStock: "",
      infusionStock: "",
    };
    setEditing(m);
    setForm(next);
    setOrigSig(unitSig(next));
    setError("");
    setShowForm(true);
  }

  // Đã đổi loại thuốc / đơn vị / tỷ lệ quy đổi so với lúc mở form sửa?
  const structureChanged = !!editing && unitSig(form) !== origSig;
  // Số lượng bác sĩ đang nhập trong form (theo đơn vị lớn nhất)
  const stockInput = form.injection
    ? form.injectionStock
    : form.infusion
    ? form.infusionStock
    : form.values[form.ticked[0]] ?? "";

  const stockLabel = editing ? "Số lượng tồn" : "Số lượng nhập ban đầu";
  // Khi sửa mà chưa đổi cấu trúc: để trống nghĩa là giữ nguyên tồn — nói rõ ngay trong ô nhập.
  const stockPlaceholder = (add: string) =>
    !editing ? add : structureChanged ? "nhập lại số tồn" : "giữ nguyên tồn";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // Đổi cấu trúc kho ⇒ tồn cũ tính theo base_unit cũ, không quy đổi được ⇒ bắt nhập lại.
    if (structureChanged && !stockInput.trim()) {
      setError("Bạn đã đổi loại thuốc / đơn vị — phải nhập lại số lượng tồn để đảm bảo đúng.");
      return;
    }

    const common = {
      name: form.name,
      lowStockThreshold: Number(form.lowStockThreshold) || 30,
      imagePath: form.imagePath,
      // Khi SỬA: chỉ ghi đè tồn nếu bác sĩ thực sự nhập số (hoặc buộc phải nhập vì đổi cấu trúc).
      resetStock: editing ? stockInput.trim() !== "" : undefined,
    };

    let body: Record<string, unknown>;
    if (form.injection) {
      body = {
        ...common,
        injection: true,
        infusion: false,
        units: [],
        initialStockUnit: "ong",
        initialStockQty: Number(form.injectionStock) || 0,
      };
    } else if (form.infusion) {
      body = {
        ...common,
        injection: false,
        infusion: true,
        units: [],
        initialStockUnit: "chai",
        initialStockQty: Number(form.infusionStock) || 0,
      };
    } else {
      if (form.ticked.length === 0) {
        setError("Tick ít nhất 1 đơn vị");
        return;
      }
      // Mỗi đơn vị nhỏ hơn: số nhập = "bao nhiêu đơn vị này trong 1 đơn vị cha" = factorToNext của CHA.
      // Đơn vị lớn nhất: số nhập = số lượng tồn.
      const units = form.ticked.map((u, i) => ({
        unitName: u,
        // factorToNext của u = số của đơn-vị-con (u kế tiếp). Đơn vị nhỏ nhất → null.
        factorToNext: i < form.ticked.length - 1 ? Number(form.values[form.ticked[i + 1]]) || null : null,
      }));
      const largest = form.ticked[0];
      body = {
        ...common,
        injection: false,
        infusion: false,
        units,
        initialStockUnit: largest,
        initialStockQty: Number(form.values[largest]) || 0,
      };
    }

    setSaving(true);
    try {
      await api(
        editing ? `/api/doctor/medicines/${editing.id}` : "/api/doctor/medicines",
        { method: editing ? "PUT" : "POST", body: JSON.stringify(body) }
      );
      closeForm();
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    setOrigSig("");
    setForm(emptyForm());
  }

  async function remove(m: Medicine) {
    await api(`/api/doctor/medicines/${m.id}`, { method: "DELETE" });
    // Đang sửa đúng thuốc vừa xóa thì đóng form, tránh PUT vào bản ghi đã xóa.
    if (editing?.id === m.id) closeForm();
    load();
  }

  // Xem trước tổng quy đổi để bác sĩ yên tâm
  function previewTotal(): string {
    if (form.injection || form.infusion || form.ticked.length === 0) return "";
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
          <button
            onClick={() => {
              // Đang sửa thuốc → chuyển về thêm mới (vẫn mở form); ngược lại đóng/mở form.
              const wasEditing = !!editing;
              closeForm();
              setShowForm(wasEditing || !showForm);
            }}
            className="btn-primary shrink-0"
          >
            <IconPlus />
            Thêm thuốc
          </button>
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

      {showForm && (
        <form onSubmit={save} className="card p-5 mb-4 space-y-4">
          <p className="font-semibold text-ink">{editing ? `Sửa thuốc: ${editing.name}` : "Thêm thuốc mới"}</p>
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
                <Image src={form.imageUrl} alt="" fill sizes="80px" className="object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400"><IconPill size={26} /></div>
              )}
            </div>
            <label className="text-sm border rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-50">
              {uploading ? "Đang tải..." : "Chọn ảnh thuốc"}
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadImage} className="hidden" disabled={uploading} />
            </label>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.injection}
                onChange={(e) => setForm({ ...form, injection: e.target.checked, infusion: false })}
              />
              <span className="text-purple-600"><IconSyringe size={15} /></span>
              Thuốc tiêm (chỉ dùng đơn vị &quot;ống&quot;, không quy đổi)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.infusion}
                onChange={(e) => setForm({ ...form, infusion: e.target.checked, injection: false })}
              />
              <span className="text-sky-600"><IconDroplet size={15} /></span>
              Truyền dịch (chỉ dùng đơn vị &quot;chai&quot;, không quy đổi)
            </label>
          </div>

          {editing && (
            <div className={`rounded-lg p-3 text-sm border ${structureChanged ? "border-amber-300 bg-amber-50" : "bg-gray-50"}`}>
              <p>
                Tồn hiện tại: <span className="font-medium">{editing.stockDisplay}</span>
                <span className="text-gray-500"> ({editing.stockBaseQty} {editing.baseUnitLabel})</span>
              </p>
              {structureChanged ? (
                <p className="text-amber-800 mt-1">
                  Bạn đã đổi loại thuốc / đơn vị quy đổi — tồn cũ tính theo đơn vị cũ nên không quy đổi được.
                  <strong> Hãy nhập lại số lượng tồn từ đầu.</strong>
                </p>
              ) : (
                <p className="text-xs text-gray-500 mt-1">
                  Để trống ô số lượng = giữ nguyên tồn hiện tại. Nhập số = GHI ĐÈ tồn (cộng/trừ thì dùng nút &quot;Nhập / chỉnh&quot;).
                </p>
              )}
            </div>
          )}

          {form.injection ? (
            <div className="border rounded-lg p-3 bg-purple-50/40">
              <label className="block text-sm mb-1 font-medium">{stockLabel} (ống)</label>
              <input
                type="number" min={0}
                value={form.injectionStock}
                onChange={(e) => setForm({ ...form, injectionStock: e.target.value })}
                className="input-sm w-40"
                placeholder={stockPlaceholder("VD: 50")}
              />
            </div>
          ) : form.infusion ? (
            <div className="border rounded-lg p-3 bg-sky-50/40">
              <label className="block text-sm mb-1 font-medium">{stockLabel} (chai)</label>
              <input
                type="number" min={0}
                value={form.infusionStock}
                onChange={(e) => setForm({ ...form, infusionStock: e.target.value })}
                className="input-sm w-40"
                placeholder={stockPlaceholder("VD: 20")}
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
                            <span className="text-gray-600">{editing ? "số lượng tồn:" : "số lượng nhập:"}</span>
                            <input
                              type="number" min={0}
                              value={form.values[u] ?? ""}
                              onChange={(e) => setForm({ ...form, values: { ...form.values, [u]: e.target.value } })}
                              className="input-sm w-24"
                              placeholder={stockPlaceholder("VD 10")}
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
                              className="input-sm w-24"
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
                    <p className="text-sm text-blue-700 font-medium pt-1">
                      {editing ? "Tồn sau khi lưu " : "Tồn ban đầu "}{previewTotal()}
                    </p>
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
          <div className="flex gap-2">
            <button type="submit" disabled={saving || uploading} className="btn-primary">
              {saving ? "Đang lưu..." : editing ? "Cập nhật thuốc" : "Lưu thuốc"}
            </button>
            <button type="button" onClick={closeForm} className="btn-ghost">Hủy</button>
          </div>
        </form>
      )}

      {loading && <Loading />}
      {!loading && loadFailed && <LoadError onRetry={load} />}
      {!loading && !loadFailed && filtered.length === 0 && !showForm && (
        <EmptyState
          icon={<IconPill size={22} />}
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
                      <button onClick={() => startEdit(m)} className="font-medium text-blue-700 hover:underline mr-3">Sửa</button>
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
