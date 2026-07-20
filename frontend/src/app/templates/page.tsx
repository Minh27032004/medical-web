"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import Pager from "@/components/Pager";
import { Badge, EmptyState, IconDroplet, IconPill, IconPlus, IconStar, IconSyringe } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { Medicine, Page, Template } from "@/lib/types";
import { deriveUsage, SESSIONS, USAGE_OPTIONS, usageModeToNote, type UsageMode } from "@/lib/usage";

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
}

const emptyForm = (): FormState => ({
  id: null, name: "", medicineId: null, medicineName: "",
  doseMorning: "", doseNoon: "", doseAfternoon: "", doseEvening: "",
  usageMode: "", usageCustom: "",
});

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Template | null>(null); // mẫu chờ xác nhận xóa

  // Filter + phân trang (client-side trên danh sách đã tải).
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<StockFilter>("all");
  const [page, setPage] = useState(0);

  const load = useCallback(() => {
    api<Template[]>("/api/doctor/templates").then(setTemplates).catch(() => {});
  }, []);

  useEffect(load, [load]);

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
      usageNote: usageModeToNote(form.usageMode, form.usageCustom),
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
    <div className="max-w-3xl mx-auto">
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
        <form onSubmit={save} className="card p-5 mb-4 space-y-3">
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
                onPick={(m) => setForm({ ...form, medicineId: m?.id ?? null, medicineName: m?.name ?? "" })}
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
                        onChange={(e) => setForm({ ...form, [f]: e.target.checked ? "1" : "" })}
                      />
                      {label}
                    </label>
                    {checked && (
                      <input
                        type="number" min={0} step="any"
                        value={form[f]}
                        onChange={(e) => setForm({ ...form, [f]: e.target.value })}
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
            {USAGE_OPTIONS.map(([m, label]) => (
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
        {filtered.length === 0 && !form && (
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

function MedicinePicker({ value, onPick }: { value: string; onPick: (m: Medicine | null) => void }) {
  const [input, setInput] = useState(value);
  const [options, setOptions] = useState<Medicine[]>([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = input.trim();
    if (!q) { setOptions([]); return; }
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      api<Page<Medicine>>(`/api/doctor/medicines?q=${encodeURIComponent(q)}&size=8`, { signal: ctrl.signal })
        .then((p) => { setOptions(p.content); setOpen(p.content.length > 0); })
        .catch(() => {});
    }, 250);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [input]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={wrapRef} className="relative">
      <input
        value={input}
        onChange={(e) => { setInput(e.target.value); onPick(null); }}
        placeholder="(tùy chọn) gõ tên thuốc kho..."
        className="input"
      />
      {open && (
        <div className="absolute z-20 top-full left-0 right-0 bg-white border border-gray-100 rounded-xl shadow-lg mt-1 max-h-52 overflow-y-auto">
          {options.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => { onPick(m); setInput(m.name); setOpen(false); }}
              className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm"
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
