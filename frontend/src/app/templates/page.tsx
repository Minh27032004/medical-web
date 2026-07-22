"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import Pager from "@/components/Pager";
import { Badge, EmptyState, IconDroplet, IconPill, IconPlus, IconStar, IconSyringe, LoadError } from "@/components/ui";
import { useApiData } from "@/hooks/useApiData";
import { blockImplicitSubmit, useFocusField } from "@/hooks/useFocusField";
import { useMedicines } from "@/hooks/usePreloaded";
import { api, ApiError } from "@/lib/api";
import { containsVi, normalizeVi } from "@/lib/search";
import type { Medicine, Template } from "@/lib/types";
import { deriveUsage, fixedUsageNote, SESSIONS, USAGE_OPTIONS, usageModeToNote, type UsageMode } from "@/lib/usage";

const PAGE_SIZE = 10;
type StockFilter = "all" | "oral" | "injection" | "infusion";

interface FormState {
  id: string | null;
  name: string;
  medicineId: string | null;
  medicineName: string;
  doseMorning: string;
  doseNoon: string;
  doseAfternoon: string;
  doseEvening: string;
  usageMode: UsageMode;
  usageCustom: string;
  /** Loại thuốc kho đã gắn — quyết định có hỏi trước/sau ăn hay không. */
  injection: boolean;
  infusion: boolean;
}

const emptyForm = (): FormState => ({
  id: null, name: "", medicineId: null, medicineName: "",
  doseMorning: "", doseNoon: "", doseAfternoon: "", doseEvening: "",
  usageMode: "", usageCustom: "", injection: false, infusion: false,
});

export default function TemplatesPage() {
  const { data: templates = [], loading, failed, reload: load } = useApiData<Template[]>(
    "/api/doctor/templates"
  );
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Template | null>(null); // mẫu chờ xác nhận xóa
  const focusField = useFocusField();

  // Filter + phân trang (client-side trên danh sách đã tải).
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<StockFilter>("all");
  const [page, setPage] = useState(0);

  // Lọc theo tên + loại thuốc; reset về trang đầu khi đổi điều kiện.
  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return templates.filter((t) => {
      if (kw && !t.name.toLowerCase().includes(kw)) return false;
      if (filter === "oral" && (t.injection || t.infusion)) return false;
      if (filter === "injection" && !t.injection) return false;
      if (filter === "infusion" && !t.infusion) return false;
      return true;
    });
  }, [templates, q, filter]);

  useEffect(() => setPage(0), [q, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  function editTemplate(t: Template) {
    setForm({
      id: t.id, name: t.name, medicineId: t.medicineId, medicineName: t.medicineName ?? "",
      doseMorning: t.doseMorning ? String(t.doseMorning) : "",
      doseNoon: t.doseNoon ? String(t.doseNoon) : "",
      doseAfternoon: t.doseAfternoon ? String(t.doseAfternoon) : "",
      doseEvening: t.doseEvening ? String(t.doseEvening) : "",
      injection: t.injection, infusion: t.infusion,
      ...deriveUsage(t.usageNote),
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError("");
    const body = JSON.stringify({
      name: form.name,
      medicineId: form.medicineId,
      doseMorning: Number(form.doseMorning) || 0,
      doseNoon: Number(form.doseNoon) || 0,
      doseAfternoon: Number(form.doseAfternoon) || 0,
      doseEvening: Number(form.doseEvening) || 0,
      usageNote: usageModeToNote(form.usageMode, form.usageCustom)
        ?? fixedUsageNote(form.injection, form.infusion),
      numDays: null, // số ngày thuộc về cả đơn thuốc, không lưu ở thuốc mẫu nữa
    });
    try {
      if (form.id) await api(`/api/doctor/templates/${form.id}`, { method: "PUT", body });
      else await api("/api/doctor/templates", { method: "POST", body });
      setForm(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  }

  async function remove(t: Template) {
    await api(`/api/doctor/templates/${t.id}`, { method: "DELETE" });
    if (form?.id === t.id) setForm(null); // đang sửa đúng mẫu vừa xóa → đóng form
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
        <h1 className="page-title">Thuốc mẫu</h1>
        <button onClick={() => setForm(emptyForm())} className="btn-primary">
          <IconPlus />
          Thêm thuốc mẫu
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Thuốc hay kê với liều mặc định — khi kê đơn gõ tên sẽ được gợi ý ưu tiên và tự điền liều.
      </p>

      {form && (
        <form onSubmit={save} onKeyDown={blockImplicitSubmit} className="card p-5 mb-4 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1.5 font-medium text-gray-600">Tên hiển thị *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input"
                required
              />
            </div>
            <div>
              <label className="block text-sm mb-1.5 font-medium text-gray-600">Liên kết thuốc trong kho (để trừ tồn)</label>
              <MedicinePicker
                value={form.medicineName}
                onPick={(m) => setForm({
                ...form,
                medicineId: m?.id ?? null,
                medicineName: m?.name ?? "",
                injection: m?.injection ?? false,
                infusion: m?.infusion ?? false,
              })}
                // Chọn xong thuốc kho là sang ngay phần liều — bấm Enter tiếp là tick
                // "Sáng" và vào ô liều luôn, giống hệt màn kê đơn.
                onPicked={() => focusField("chk:doseMorning")}
              />
            </div>
          </div>

          {/* Liều mặc định: tick buổi nào mới hiện ô nhập */}
          <div>
            <p className="text-sm mb-1">Liều mặc định mỗi buổi</p>
            <div className="flex items-start gap-3 flex-wrap">
              {SESSIONS.map(([f, label]) => {
                const checked = form[f] !== "";
                return (
                  <div key={f} className="text-center">
                    <label className="flex items-center gap-1 text-[11px] text-gray-600 cursor-pointer justify-center h-9">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setForm({ ...form, [f]: e.target.checked ? "1" : "" });
                          // Tick bằng Space/chuột cũng vào ô liều — ô đó đã ra khỏi thứ
                          // tự Tab nên đây là đường duy nhất tới nó bằng bàn phím.
                          if (e.target.checked) focusField(`dose:${f}`);
                        }}
                        data-focus-key={`chk:${f}`}
                        /**
                         * Enter = tick buổi này rồi vào thẳng ô liều (mặc định "1" đã bôi
                         * đen, gõ số khác là đè). Space vẫn bật/tắt như checkbox chuẩn —
                         * giữ nguyên để còn đường BỎ tick; Enter không bỏ tick vì lỡ tay
                         * xóa mất liều đã gõ khó chịu hơn nhiều so với phải bấm Space.
                         */
                        onKeyDown={(e) => {
                          if (e.key !== "Enter") return;
                          e.preventDefault();
                          if (!checked) setForm({ ...form, [f]: "1" });
                          focusField(`dose:${f}`);
                        }}
                      />
                      {label}
                    </label>
                    {checked && (
                      <input
                        type="number" min={0} step="any"
                        value={form[f]}
                        onChange={(e) => setForm({ ...form, [f]: e.target.value })}
                        data-focus-key={`dose:${f}`}
                        // Ra khỏi thứ tự Tab để Tab chỉ nhảy giữa 4 buổi — xem ghi chú
                        // đầy đủ ở form kê đơn. Vẫn focus được bằng focusField/chuột.
                        tabIndex={-1}
                        className="input-sm w-14 px-1 text-center"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cách dùng mặc định: 3 nút, "Khác" mở ô nhập */}
          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-sm text-gray-600">Cách dùng:</span>
            {(form.injection || form.infusion) && (
              <>
                {form.usageMode !== "other" && (
                  <span className="text-xs font-medium text-gray-700">
                    {fixedUsageNote(form.injection, form.infusion)}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setForm({
                    ...form,
                    usageMode: form.usageMode === "other" ? "" : "other",
                    usageCustom: "",
                  })}
                  className={`text-xs px-2.5 py-1 rounded-full border ${
                    form.usageMode === "other"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  Ghi riêng
                </button>
              </>
            )}
            {!form.injection && !form.infusion && USAGE_OPTIONS.map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => setForm({ ...form, usageMode: form.usageMode === m ? "" : m })}
                className={`text-xs px-2.5 py-1 rounded-full border ${
                  form.usageMode === m
                    ? "bg-blue-600 text-white border-blue-600"
                    : "border-gray-300 hover:bg-gray-50"
                }`}
              >
                {label}
              </button>
            ))}
            {form.usageMode === "other" && (
              <input
                value={form.usageCustom}
                onChange={(e) => setForm({ ...form, usageCustom: e.target.value })}
                className="input-sm flex-1 min-w-40"
                autoFocus
              />
            )}
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Đang lưu..." : "Lưu"}
            </button>
            <button type="button" onClick={() => setForm(null)} className="btn-ghost">Hủy</button>
          </div>
        </form>
      )}

      {/* Filter: tìm kiếm + loại thuốc */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm thuốc mẫu..."
          className="input flex-1 min-w-48"
        />
        <div className="flex gap-1.5 text-sm">
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
        </div>
      </div>

      <div className="space-y-2">
        {failed && <LoadError onRetry={load} />}
        {!failed && !loading && filtered.length === 0 && !form && (
          <EmptyState
            icon={<IconStar size={20} />}
            title={templates.length === 0 ? "Chưa có thuốc mẫu nào" : "Không có thuốc mẫu khớp bộ lọc"}
            hint={templates.length === 0 ? "Lưu các thuốc hay kê kèm liều mặc định để kê đơn nhanh hơn." : "Thử đổi từ khóa hoặc bộ lọc uống/tiêm."}
          />
        )}
        {pageItems.map((t) => (
          <div key={t.id} className="card px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={t.injection ? "text-purple-600" : t.infusion ? "text-sky-600" : "text-amber-500"}>
                {t.injection ? <IconSyringe size={15} /> : t.infusion ? <IconDroplet size={15} /> : <IconStar size={15} />}
              </span>
              <span className="font-medium text-ink">{t.name}</span>
              <span className="text-sm text-gray-500">
                {[t.doseMorning, t.doseNoon, t.doseAfternoon, t.doseEvening].join("-")}
                {t.usageNote && ` · ${t.usageNote}`}
              </span>
              {t.medicineName && (
                <Badge tone="blue">kho: {t.medicineName}</Badge>
              )}
            </div>
            <div className="text-sm shrink-0">
              <button onClick={() => editTemplate(t)} className="text-blue-700 hover:underline mr-3">Sửa</button>
              <button onClick={() => setDeleting(t)} className="text-red-600 hover:underline">Xóa</button>
            </div>
          </div>
        ))}
      </div>

      <Pager page={page} totalPages={totalPages} onPage={setPage} />

      <ConfirmDialog
        open={!!deleting}
        title={`Xóa thuốc mẫu "${deleting?.name}"?`}
        message="Chỉ xóa mẫu kê nhanh — thuốc trong kho và các đơn đã kê không bị ảnh hưởng."
        onConfirm={() => remove(deleting!)}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

function MedicinePicker({
  value, onPick, onPicked,
}: { value: string; onPick: (m: Medicine | null) => void; onPicked: () => void }) {
  const [input, setInput] = useState(value);
  const [dismissed, setDismissed] = useState(false);
  /**
   * Dòng gợi ý đang chọn bằng BÀN PHÍM; -1 = chưa chọn gì. Bắt đầu từ -1 để Enter không
   * tự gắn đại một thuốc kho vào mẫu — gắn sai thuốc là mọi đơn kê từ mẫu này về sau đều
   * trừ nhầm tồn. Muốn chọn thì bấm ↓.
   */
  const [sel, setSel] = useState({ q: "", i: -1 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const all = useMedicines();

  /**
   * Lọc trong RAM, không request mỗi lần gõ — kho tải sẵn một lần (xem usePreloaded).
   * Cắt 8 dòng như trần size=8 của endpoint cũ để danh sách vẫn ngắn, dễ chọn.
   */
  const nq = normalizeVi(input.trim());
  const options = nq ? all.filter((m) => containsVi(m.name, nq)).slice(0, 8) : [];
  const open = !dismissed && options.length > 0;

  // Dòng đang chọn chỉ có nghĩa với đúng từ khóa sinh ra nó — xem ghi chú ở form kê đơn.
  const active = sel.q === input ? sel.i : -1;
  const setActive = (next: number | ((i: number) => number)) =>
    setSel({ q: input, i: typeof next === "function" ? next(active) : next });

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setDismissed(true);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function pick(m: Medicine) {
    onPick(m);
    setInput(m.name);
    setDismissed(true);
    onPicked();
  }

  /**
   * Enter luôn nghĩa là "xong ô này, đi tiếp": có dòng đang chọn (↓/↑) thì gắn thuốc kho
   * đó, không có thì bỏ qua liên kết kho và sang phần liều — không tự gắn đại. Trước đây
   * Enter ở đây rơi xuống form và lưu luôn thuốc mẫu; nay form đã chặn Enter, nếu không
   * bắt ở đây thì Enter thành phím chết.
   */
  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") { setDismissed(true); setActive(-1); return; }
    if (e.key === "Enter") {
      e.preventDefault();
      const chosen = open ? options[active] : undefined;
      if (chosen) pick(chosen);
      else { setDismissed(true); onPicked(); }
      return;
    }
    if (!open || options.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % options.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? options.length : i) - 1);
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        value={input}
        onChange={(e) => { setInput(e.target.value); setDismissed(false); onPick(null); }}
        onKeyDown={onKey}
        placeholder="(tùy chọn) gõ tên thuốc kho..."
        className="input"
      />
      {open && (
        <div className="absolute z-20 top-full left-0 right-0 bg-white border border-gray-100 rounded-xl shadow-lg mt-1 max-h-52 overflow-y-auto">
          {options.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onClick={() => pick(m)}
              // Không setActive khi rê chuột — xem ghi chú cùng chỗ ở form kê đơn.
              className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 ${
                i === active ? "bg-blue-100 ring-1 ring-inset ring-blue-400" : ""
              }`}
            >
              {m.injection && <span className="text-purple-600 inline-block align-text-bottom mr-1"><IconSyringe size={13} /></span>}
              {m.infusion && <span className="text-sky-600 inline-block align-text-bottom mr-1"><IconDroplet size={13} /></span>}
              {m.name} <span className="text-xs text-gray-500">({m.stockDisplay})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
