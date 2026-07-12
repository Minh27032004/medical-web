"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Medicine, Page, Template } from "@/lib/types";

interface FormState {
  id: string | null;
  name: string;
  medicineId: string | null;
  medicineName: string;
  doseMorning: string;
  doseNoon: string;
  doseAfternoon: string;
  doseEvening: string;
  usageNote: string;
  numDays: string;
}

const emptyForm = (): FormState => ({
  id: null, name: "", medicineId: null, medicineName: "",
  doseMorning: "", doseNoon: "", doseAfternoon: "", doseEvening: "",
  usageNote: "", numDays: "",
});

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api<Template[]>("/api/doctor/templates").then(setTemplates).catch(() => {});
  }, []);

  useEffect(load, [load]);

  function editTemplate(t: Template) {
    setForm({
      id: t.id, name: t.name, medicineId: t.medicineId, medicineName: t.medicineName ?? "",
      doseMorning: t.doseMorning ? String(t.doseMorning) : "",
      doseNoon: t.doseNoon ? String(t.doseNoon) : "",
      doseAfternoon: t.doseAfternoon ? String(t.doseAfternoon) : "",
      doseEvening: t.doseEvening ? String(t.doseEvening) : "",
      usageNote: t.usageNote ?? "", numDays: t.numDays ? String(t.numDays) : "",
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
      usageNote: form.usageNote || null,
      numDays: Number(form.numDays) || null,
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
    if (!confirm(`Xóa thuốc mẫu "${t.name}"?`)) return;
    await api(`/api/doctor/templates/${t.id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-bold">Thuốc mẫu</h1>
        <button
          onClick={() => setForm(emptyForm())}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
        >
          + Thêm thuốc mẫu
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Thuốc hay kê với liều mặc định — khi kê đơn gõ tên sẽ được gợi ý ưu tiên và tự điền liều.
      </p>

      {form && (
        <form onSubmit={save} className="bg-white border rounded-xl p-5 mb-4 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">Tên hiển thị *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Liên kết thuốc trong kho (để trừ tồn)</label>
              <MedicinePicker
                value={form.medicineName}
                onPick={(m) => setForm({ ...form, medicineId: m?.id ?? null, medicineName: m?.name ?? "" })}
              />
            </div>
          </div>
          <div className="flex items-end gap-2 flex-wrap">
            {(["doseMorning", "doseNoon", "doseAfternoon", "doseEvening"] as const).map((f, i) => (
              <div key={f} className="text-center">
                <input
                  type="number" min={0} step="any"
                  value={form[f]}
                  onChange={(e) => setForm({ ...form, [f]: e.target.value })}
                  className="w-16 border rounded-lg px-1 py-2 text-sm text-center"
                />
                <p className="text-[10px] text-gray-500">{["Sáng", "Trưa", "Chiều", "Tối"][i]}</p>
              </div>
            ))}
            <div className="text-center">
              <input
                type="number" min={1}
                value={form.numDays}
                onChange={(e) => setForm({ ...form, numDays: e.target.value })}
                className="w-16 border rounded-lg px-1 py-2 text-sm text-center"
              />
              <p className="text-[10px] text-gray-500">Số ngày</p>
            </div>
            <input
              value={form.usageNote}
              onChange={(e) => setForm({ ...form, usageNote: e.target.value })}
              placeholder="Cách dùng mặc định"
              className="flex-1 min-w-40 border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Đang lưu..." : "Lưu"}
            </button>
            <button type="button" onClick={() => setForm(null)} className="border px-4 py-2 rounded-lg text-sm">Hủy</button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {templates.length === 0 && !form && (
          <p className="text-gray-500 text-sm py-6 text-center">Chưa có thuốc mẫu nào.</p>
        )}
        {templates.map((t) => (
          <div key={t.id} className="bg-white border rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <span className="font-medium">★ {t.name}</span>
              <span className="text-sm text-gray-500 ml-2">
                {[t.doseMorning, t.doseNoon, t.doseAfternoon, t.doseEvening].join("-")}
                {t.numDays && ` × ${t.numDays} ngày`}
                {t.usageNote && ` · ${t.usageNote}`}
              </span>
              {t.medicineName && (
                <span className="text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded ml-2">
                  kho: {t.medicineName}
                </span>
              )}
            </div>
            <div className="text-sm shrink-0">
              <button onClick={() => editTemplate(t)} className="text-blue-700 hover:underline mr-3">Sửa</button>
              <button onClick={() => remove(t)} className="text-red-600 hover:underline">Xóa</button>
            </div>
          </div>
        ))}
      </div>
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
    const timer = setTimeout(() => {
      api<Page<Medicine>>(`/api/doctor/medicines?q=${encodeURIComponent(q)}&size=8`)
        .then((p) => { setOptions(p.content); setOpen(p.content.length > 0); })
        .catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
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
        className="w-full border rounded-lg px-3 py-2 text-sm"
      />
      {open && (
        <div className="absolute z-20 top-full left-0 right-0 bg-white border rounded-lg shadow-lg mt-1 max-h-52 overflow-y-auto">
          {options.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => { onPick(m); setInput(m.name); setOpen(false); }}
              className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm"
            >
              {m.name} <span className="text-xs text-gray-500">({m.stockDisplay})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
