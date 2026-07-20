"use client";

import Image from "next/image";
import { useState } from "react";
import { IconDroplet, IconPill, IconSyringe } from "@/components/ui";
import { api, apiForm, ApiError } from "@/lib/api";
import { UNIT_LABEL, UNIT_OPTIONS, type Medicine } from "@/lib/types";

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

/** Dựng state form từ một thuốc có sẵn (chế độ SỬA). */
function formOf(m: Medicine): FormState {
  return {
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
}

/**
 * Form thuốc — DÙNG CHUNG cho thêm mới và sửa, để hai luồng không bao giờ lệch nhau.
 * `initial` có = chế độ sửa (PUT), không có = thêm mới (POST).
 */
export default function MedicineForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: Medicine;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const editing = initial ?? null;
  const [form, setForm] = useState<FormState>(() => (editing ? formOf(editing) : emptyForm()));
  const [origSig] = useState(() => (editing ? unitSig(formOf(editing)) : ""));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

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

  // Xem trước tổng quy đổi để bác sĩ yên tâm
  function previewTotal(): string {
    if (form.injection || form.infusion || form.ticked.length === 0) return "";
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
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Lưu thất bại");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="card p-5 space-y-4">
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
        <button type="button" onClick={onCancel} disabled={saving} className="btn-ghost">Hủy</button>
      </div>
    </form>
  );
}
