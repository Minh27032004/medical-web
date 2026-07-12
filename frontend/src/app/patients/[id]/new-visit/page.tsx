"use client";

import { useRouter } from "next/navigation";
import { use, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Icd10, Patient, RxItem, Suggestion, VisitDetail } from "@/lib/types";

interface ItemForm {
  medicineId: string | null;
  medicineName: string;
  baseUnitLabel: string | null;
  stockDisplay: string | null;
  doseMorning: string;
  doseNoon: string;
  doseAfternoon: string;
  doseEvening: string;
  specialDoseText: string;
  usageNote: string;
  numDays: string;
  injection: boolean;
}

const emptyItem = (injection = false): ItemForm => ({
  medicineId: null,
  medicineName: "",
  baseUnitLabel: null,
  stockDisplay: null,
  doseMorning: "",
  doseNoon: "",
  doseAfternoon: "",
  doseEvening: "",
  specialDoseText: "",
  usageNote: "",
  numDays: "",
  injection,
});

function totalOf(it: ItemForm): number {
  const daily =
    (Number(it.doseMorning) || 0) + (Number(it.doseNoon) || 0) +
    (Number(it.doseAfternoon) || 0) + (Number(it.doseEvening) || 0);
  return daily * (Number(it.numDays) || 0);
}

/** Ô chẩn đoán ICD-10 hai chiều (§5.3): gõ mã + space/enter → ra tên; gõ tên → gợi ý mã. */
function IcdPicker({
  code, name, onPick,
}: { code: string; name: string; onPick: (code: string, name: string) => void }) {
  const [input, setInput] = useState(code ? `${code} — ${name}` : "");
  const [options, setOptions] = useState<Icd10[]>([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = input.trim();
    if (!q || q.includes("—")) { setOptions([]); return; }
    const timer = setTimeout(() => {
      api<Icd10[]>(`/api/doctor/icd10?q=${encodeURIComponent(q)}`)
        .then((r) => { setOptions(r); setOpen(r.length > 0); })
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

  function pick(o: Icd10) {
    onPick(o.code, o.name);
    setInput(`${o.code} — ${o.name}`);
    setOpen(false);
  }

  // gõ mã rồi space/enter → chọn kết quả khớp mã đầu tiên
  function onKey(e: React.KeyboardEvent) {
    if ((e.key === " " || e.key === "Enter") && options.length > 0) {
      const exact = options.find((o) => o.code.toLowerCase() === input.trim().toLowerCase());
      if (exact || e.key === "Enter") {
        e.preventDefault();
        pick(exact ?? options[0]);
      }
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        value={input}
        onChange={(e) => { setInput(e.target.value); onPick("", ""); }}
        onKeyDown={onKey}
        placeholder="Gõ mã (J00 + space) hoặc tên bệnh..."
        className={`w-full border rounded-lg px-3 py-2 ${code ? "border-blue-400 bg-blue-50/40" : ""}`}
        required={!code}
      />
      {open && (
        <div className="absolute z-20 top-full left-0 right-0 bg-white border rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto">
          {options.map((o) => (
            <button
              key={o.code}
              type="button"
              onClick={() => pick(o)}
              className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm"
            >
              <span className="font-mono font-semibold text-blue-800">{o.code}</span> — {o.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Ô thuốc có autocomplete: thuốc mẫu trước (tự điền liều), thuốc kho sau, kèm tồn (§5.4). */
function MedicineInput({
  item, onChange,
}: { item: ItemForm; onChange: (patch: Partial<ItemForm>) => void }) {
  const [options, setOptions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = item.medicineName.trim();
    if (!q || item.medicineId) { setOptions([]); return; }
    const timer = setTimeout(() => {
      api<Suggestion[]>(`/api/doctor/suggest?q=${encodeURIComponent(q)}`)
        .then((r) => {
          const filtered = r.filter((s) => s.injection === item.injection);
          setOptions(filtered);
          setOpen(filtered.length > 0);
        })
        .catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [item.medicineName, item.medicineId, item.injection]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function pick(s: Suggestion) {
    onChange({
      medicineId: s.medicineId,
      medicineName: s.name,
      baseUnitLabel: s.baseUnitLabel,
      stockDisplay: s.stockDisplay,
      // thuốc mẫu tự điền liều mặc định
      ...(s.type === "TEMPLATE" && {
        doseMorning: s.doseMorning ? String(s.doseMorning) : "",
        doseNoon: s.doseNoon ? String(s.doseNoon) : "",
        doseAfternoon: s.doseAfternoon ? String(s.doseAfternoon) : "",
        doseEvening: s.doseEvening ? String(s.doseEvening) : "",
        usageNote: s.usageNote ?? "",
        numDays: s.numDays ? String(s.numDays) : "",
      }),
    });
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className="relative flex-1 min-w-44">
      <input
        value={item.medicineName}
        onChange={(e) => onChange({ medicineName: e.target.value, medicineId: null, stockDisplay: null })}
        placeholder={item.injection ? "Tên thuốc tiêm..." : "Tên thuốc..."}
        className="w-full border rounded-lg px-3 py-2 text-sm"
      />
      {item.stockDisplay && (
        <p className="text-[11px] text-gray-500 mt-0.5">Tồn: {item.stockDisplay}</p>
      )}
      {open && (
        <div className="absolute z-20 top-full left-0 right-0 bg-white border rounded-lg shadow-lg mt-1 max-h-56 overflow-y-auto">
          {options.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => pick(s)}
              className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm flex justify-between gap-2"
            >
              <span>
                {s.type === "TEMPLATE" && <span className="text-amber-600 mr-1" title="Thuốc mẫu">★</span>}
                {s.name}
              </span>
              {s.stockDisplay && <span className="text-xs text-gray-500 shrink-0">{s.stockDisplay}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NewVisitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: patientId } = use(params);
  const router = useRouter();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [diagCode, setDiagCode] = useState("");
  const [diagName, setDiagName] = useState("");
  const [note, setNote] = useState("");
  const [items, setItems] = useState<ItemForm[]>([emptyItem()]);
  const [hasInjectionRow, setHasInjectionRow] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<Patient>(`/api/doctor/patients/${patientId}`).then(setPatient).catch(() => {});
  }, [patientId]);

  function updateItem(idx: number, patch: Partial<ItemForm>) {
    setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  /** Nút "Tạo lại đơn gần nhất" (§5.4) — copy dòng thuốc từ lần khám trước. */
  async function copyLast() {
    try {
      const last = await api<RxItem[]>(`/api/doctor/patients/${patientId}/last-prescription`);
      if (last.length === 0) {
        setError("Bệnh nhân chưa có đơn nào trước đó");
        return;
      }
      setItems(
        last.map((r) => ({
          medicineId: r.medicineId,
          medicineName: r.medicineName,
          baseUnitLabel: r.baseUnitLabel,
          stockDisplay: null,
          doseMorning: r.doseMorning ? String(r.doseMorning) : "",
          doseNoon: r.doseNoon ? String(r.doseNoon) : "",
          doseAfternoon: r.doseAfternoon ? String(r.doseAfternoon) : "",
          doseEvening: r.doseEvening ? String(r.doseEvening) : "",
          specialDoseText: r.specialDoseText ?? "",
          usageNote: r.usageNote ?? "",
          numDays: r.numDays ? String(r.numDays) : "",
          injection: r.injection,
        }))
      );
      setHasInjectionRow(last.some((r) => r.injection));
      setError("");
    } catch {
      setError("Không lấy được đơn gần nhất");
    }
  }

  function toggleInjection(checked: boolean) {
    setHasInjectionRow(checked);
    if (checked && !items.some((i) => i.injection)) {
      setItems([...items, emptyItem(true)]);
    }
    if (!checked) {
      setItems(items.filter((i) => !i.injection));
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!diagCode) {
      setError("Chẩn đoán ICD-10 là bắt buộc — chọn từ danh sách gợi ý");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const detail = await api<VisitDetail>("/api/doctor/visits", {
        method: "POST",
        body: JSON.stringify({
          patientId,
          diagnosisCode: diagCode,
          diagnosisName: diagName,
          note: note || null,
          items: items
            .filter((it) => it.medicineName.trim())
            .map((it) => ({
              medicineId: it.medicineId,
              medicineName: it.medicineName,
              doseMorning: Number(it.doseMorning) || 0,
              doseNoon: Number(it.doseNoon) || 0,
              doseAfternoon: Number(it.doseAfternoon) || 0,
              doseEvening: Number(it.doseEvening) || 0,
              specialDoseText: it.specialDoseText || null,
              usageNote: it.usageNote || null,
              numDays: Number(it.numDays) || null,
              totalQuantityBase: it.injection ? totalOf(it) || Number(it.doseMorning) || 0 : null,
              injection: it.injection,
            })),
        }),
      });
      router.push(`/visits/${detail.id}?created=1`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Lưu thất bại");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold">
          Lần khám mới {patient && <span className="text-blue-800">— {patient.fullName}</span>}
        </h1>
        <button
          type="button"
          onClick={copyLast}
          className="text-sm border border-blue-400 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-50"
        >
          ⟳ Tạo lại đơn gần nhất
        </button>
      </div>

      {patient?.hasDrugAllergy && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          ⚠ Bệnh nhân DỊ ỨNG THUỐC: {patient.drugAllergyNote || "(chưa ghi chú)"}
        </p>
      )}

      <div className="bg-white border rounded-xl p-5 space-y-4">
        <div>
          <label className="block text-sm mb-1 font-medium">Chẩn đoán (ICD-10) *</label>
          <IcdPicker code={diagCode} name={diagName} onPick={(c, n) => { setDiagCode(c); setDiagName(n); }} />
        </div>
        <div>
          <label className="block text-sm mb-1 font-medium">Ghi chú khám</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="bg-white border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium">Đơn thuốc</label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={hasInjectionRow}
              onChange={(e) => toggleInjection(e.target.checked)}
            />
            💉 Có tiêm thuốc
          </label>
        </div>

        <div className="space-y-4">
          {items.map((it, idx) => (
            <div key={idx} className={`border rounded-xl p-3 ${it.injection ? "border-purple-300 bg-purple-50/30" : ""}`}>
              <div className="flex items-start gap-2 flex-wrap">
                {it.injection && <span className="text-purple-700 text-sm py-2">💉</span>}
                <MedicineInput item={it} onChange={(p) => updateItem(idx, p)} />
                {it.injection ? (
                  <input
                    type="number" min={0} step="any"
                    value={it.doseMorning}
                    onChange={(e) => updateItem(idx, { doseMorning: e.target.value, numDays: "1" })}
                    placeholder="Số ống"
                    className="w-24 border rounded-lg px-2 py-2 text-sm"
                  />
                ) : (
                  <>
                    {(["doseMorning", "doseNoon", "doseAfternoon", "doseEvening"] as const).map((f, i2) => (
                      <div key={f} className="text-center">
                        <input
                          type="number" min={0} step="any"
                          value={it[f]}
                          onChange={(e) => updateItem(idx, { [f]: e.target.value })}
                          className="w-16 border rounded-lg px-1 py-2 text-sm text-center"
                        />
                        <p className="text-[10px] text-gray-500">{["Sáng", "Trưa", "Chiều", "Tối"][i2]}</p>
                      </div>
                    ))}
                    <div className="text-center">
                      <input
                        type="number" min={1}
                        value={it.numDays}
                        onChange={(e) => updateItem(idx, { numDays: e.target.value })}
                        className="w-16 border rounded-lg px-1 py-2 text-sm text-center"
                      />
                      <p className="text-[10px] text-gray-500">Số ngày</p>
                    </div>
                  </>
                )}
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setItems(items.filter((_, i) => i !== idx))}
                    className="text-red-600 py-2 text-sm ml-auto"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="flex gap-2 mt-2 flex-wrap items-center">
                <input
                  value={it.usageNote}
                  onChange={(e) => updateItem(idx, { usageNote: e.target.value })}
                  placeholder="Cách dùng (trước/sau ăn...) — tùy chọn"
                  className="flex-1 min-w-40 border rounded-lg px-3 py-1.5 text-sm"
                />
                <input
                  value={it.specialDoseText}
                  onChange={(e) => updateItem(idx, { specialDoseText: e.target.value })}
                  placeholder="Liều đặc biệt (nhập tự do)"
                  className="flex-1 min-w-40 border rounded-lg px-3 py-1.5 text-sm"
                />
                {!it.injection && totalOf(it) > 0 && (
                  <span className="text-xs text-blue-700 font-medium shrink-0">
                    = {totalOf(it)} {it.baseUnitLabel ?? "đơn vị"}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setItems([...items, emptyItem()])}
          className="mt-3 w-full text-sm border border-dashed border-blue-400 text-blue-700 rounded-lg py-2 hover:bg-blue-50"
        >
          + Thêm thuốc
        </button>
      </div>

      {error && (
        <p className="text-red-600 text-sm bg-red-50 border border-red-100 rounded-lg px-3 py-2">⚠ {error}</p>
      )}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Đang lưu..." : "Lưu lần khám + đơn thuốc"}
        </button>
        <button type="button" onClick={() => router.back()} className="border px-5 py-2.5 rounded-lg hover:bg-gray-50">
          Hủy
        </button>
      </div>
      <p className="text-xs text-gray-500">Lưu đơn sẽ tự trừ kho theo tổng số lượng từng thuốc.</p>
    </form>
  );
}
