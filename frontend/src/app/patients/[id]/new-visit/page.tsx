"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, use, useCallback, useEffect, useRef, useState } from "react";
import { IconAlert, IconDroplet, IconRefresh, IconStar, IconSyringe, IconX } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { Diagnosis, Icd10, Patient, RxItem, Suggestion, VisitDetail, VisitRow } from "@/lib/types";
import { deriveUsage, fixedUsageNote, SESSIONS, USAGE_OPTIONS, usageModeToNote, type UsageMode } from "@/lib/usage";

/** Ghi chú nhanh — bấm để chèn vào ô ghi chú khám. */
const QUICK_NOTES = [
  "Đau dạ dày", "Huyết áp cao", "Sốt", "Ho", "Viêm họng", "Đau đầu",
  "Tiêu chảy", "Đau bụng", "Chóng mặt", "Mất ngủ", "Uống nhiều nước",
  "Kiêng rượu bia", "Tái khám sau 5 ngày",
];

interface ItemForm {
  medicineId: string | null;
  medicineName: string;
  baseUnitLabel: string | null;
  stockDisplay: string | null;
  doseMorning: string;
  doseNoon: string;
  doseAfternoon: string;
  doseEvening: string;
  usageMode: UsageMode;
  usageCustom: string;
  injection: boolean;
  infusion: boolean;
}

const emptyItem = (injection = false, infusion = false): ItemForm => ({
  medicineId: null,
  medicineName: "",
  baseUnitLabel: null,
  stockDisplay: null,
  doseMorning: "",
  doseNoon: "",
  doseAfternoon: "",
  doseEvening: "",
  usageMode: "",
  usageCustom: "",
  injection,
  infusion,
});

/** Tổng số lượng 1 thuốc (đơn vị nhỏ nhất) = (liều mỗi buổi cộng lại) × số ngày của cả đơn. */
function totalOf(it: ItemForm, days: number): number {
  const daily =
    (Number(it.doseMorning) || 0) + (Number(it.doseNoon) || 0) +
    (Number(it.doseAfternoon) || 0) + (Number(it.doseEvening) || 0);
  return daily * (days || 0);
}

/** Ô chẩn đoán ICD-10 hai chiều (§5.3): gõ mã + space/enter → ra tên; gõ tên → gợi ý mã. */
function IcdPicker({
  code, name, onPick,
}: { code: string; name: string; onPick: (code: string, name: string) => void }) {
  const [input, setInput] = useState(code ? `${code} — ${name}` : "");
  const [options, setOptions] = useState<Icd10[]>([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Đồng bộ text khi code được set TỪ NGOÀI (vd "Tạo lại đơn" đổ chẩn đoán cũ vào).
  // Khi user gõ, onChange đặt code = "" nên effect không ghi đè.
  useEffect(() => {
    if (code) setInput(`${code} — ${name}`);
  }, [code, name]);

  useEffect(() => {
    const q = input.trim();
    if (!q || q.includes("—")) { setOptions([]); return; }
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      api<Icd10[]>(`/api/doctor/icd10?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => { setOptions(r); setOpen(r.length > 0); })
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
        className={`input ${code ? "border-blue-400 bg-blue-50/40" : ""}`}
        required={!code}
      />
      {open && (
        <div className="absolute z-20 top-full left-0 right-0 bg-white border border-gray-100 rounded-xl shadow-lg mt-1 max-h-60 overflow-y-auto">
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

/** Chẩn đoán phụ — chọn NHIỀU mã ICD-10: gõ mã + space/enter (hoặc chọn) → thêm chip. */
function IcdMultiPicker({
  items, onAdd, onRemove,
}: { items: Diagnosis[]; onAdd: (d: Diagnosis) => void; onRemove: (code: string) => void }) {
  const [input, setInput] = useState("");
  const [options, setOptions] = useState<Icd10[]>([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = input.trim();
    if (!q) { setOptions([]); return; }
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      api<Icd10[]>(`/api/doctor/icd10?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => { setOptions(r); setOpen(r.length > 0); })
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

  function add(o: Icd10) {
    if (!items.some((d) => d.code === o.code)) onAdd({ code: o.code, name: o.name });
    setInput(""); setOptions([]); setOpen(false);
  }

  function onKey(e: React.KeyboardEvent) {
    if ((e.key === " " || e.key === "Enter") && options.length > 0) {
      const exact = options.find((o) => o.code.toLowerCase() === input.trim().toLowerCase());
      if (exact || e.key === "Enter") {
        e.preventDefault();
        add(exact ?? options[0]);
      }
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {items.map((d) => (
            <span key={d.code} className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-800 rounded-full pl-2.5 pr-1 py-0.5 text-xs">
              <span className="font-mono font-semibold">{d.code}</span> — {d.name}
              <button type="button" onClick={() => onRemove(d.code)} className="text-blue-500 hover:text-red-600 px-1" aria-label="Bỏ"><IconX size={12} /></button>
            </span>
          ))}
        </div>
      )}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKey}
        className="input"
      />
      {open && (
        <div className="absolute z-20 top-full left-0 right-0 bg-white border border-gray-100 rounded-xl shadow-lg mt-1 max-h-56 overflow-y-auto">
          {options.map((o) => (
            <button
              key={o.code}
              type="button"
              onClick={() => add(o)}
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
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      api<Suggestion[]>(`/api/doctor/suggest?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => {
          const filtered = r.filter((s) => s.injection === item.injection && s.infusion === item.infusion);
          setOptions(filtered);
          setOpen(filtered.length > 0);
        })
        .catch(() => {});
    }, 250);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [item.medicineName, item.medicineId, item.injection, item.infusion]);

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
        ...deriveUsage(s.usageNote),
      }),
    });
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className="relative flex-1 min-w-44">
      <input
        value={item.medicineName}
        onChange={(e) => onChange({ medicineName: e.target.value, medicineId: null, stockDisplay: null })}
        placeholder={item.injection ? "Tên thuốc tiêm..." : item.infusion ? "Tên dịch truyền..." : "Tên thuốc..."}
        className="input"
      />
      {item.stockDisplay && (
        <p className="text-[11px] text-gray-500 mt-0.5">Tồn: {item.stockDisplay}</p>
      )}
      {open && (
        <div className="absolute z-20 top-full left-0 right-0 bg-white border border-gray-100 rounded-xl shadow-lg mt-1 max-h-56 overflow-y-auto">
          {options.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => pick(s)}
              className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm flex justify-between gap-2"
            >
              <span className="inline-flex items-center gap-1.5">
                {s.type === "TEMPLATE" && <span className="text-amber-500" title="Thuốc mẫu"><IconStar size={13} /></span>}
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

function NewVisitForm({ params }: { params: Promise<{ id: string }> }) {
  const { id: patientId } = use(params);
  const router = useRouter();
  const copyFrom = useSearchParams().get("copyFrom"); // id lần khám cần "tạo lại đơn"
  const [patient, setPatient] = useState<Patient | null>(null);
  const [diagCode, setDiagCode] = useState("");
  const [diagName, setDiagName] = useState("");
  const [secondary, setSecondary] = useState<Diagnosis[]>([]);
  const [note, setNote] = useState("");
  const [items, setItems] = useState<ItemForm[]>([emptyItem()]);
  const [numDays, setNumDays] = useState(""); // số ngày dùng chung cho CẢ đơn
  const [hasInjectionRow, setHasInjectionRow] = useState(false);
  const [hasInfusionRow, setHasInfusionRow] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  /**
   * Khóa chống tạo trùng (V15): sinh MỘT lần cho mỗi phiên mở form. Nếu lần bấm Lưu đầu
   * tới được server nhưng phản hồi mất giữa đường, bác sĩ bấm lại sẽ gửi đúng id này và
   * backend trả về lần khám cũ thay vì tạo bản ghi thứ hai + trừ kho lần nữa.
   */
  const [clientRequestId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    api<Patient>(`/api/doctor/patients/${patientId}`).then(setPatient).catch(() => {});
  }, [patientId]);

  /** Đổ danh sách thuốc từ một đơn cũ vào form + suy số ngày chung. */
  const applyRxItems = useCallback((rx: RxItem[]) => {
    setItems(
      rx.map((r) => ({
        medicineId: r.medicineId,
        medicineName: r.medicineName,
        baseUnitLabel: r.baseUnitLabel,
        stockDisplay: null,
        doseMorning: r.doseMorning ? String(r.doseMorning) : "",
        doseNoon: r.doseNoon ? String(r.doseNoon) : "",
        doseAfternoon: r.doseAfternoon ? String(r.doseAfternoon) : "",
        doseEvening: r.doseEvening ? String(r.doseEvening) : "",
        ...deriveUsage(r.usageNote),
        injection: r.injection,
        infusion: r.infusion,
      }))
    );
    setHasInjectionRow(rx.some((r) => r.injection));
    setHasInfusionRow(rx.some((r) => r.infusion));
    const d = rx.find((r) => !r.injection && !r.infusion && r.numDays)?.numDays;
    setNumDays(d ? String(d) : "");
  }, []);

  /** Đổ CẢ chẩn đoán (chính + phụ) + ghi chú + thuốc từ một lần khám vào form. */
  const loadFromVisit = useCallback(async (visitId: string) => {
    const v = await api<VisitDetail>(`/api/doctor/visits/${visitId}`);
    setDiagCode(v.diagnosisCode);
    setDiagName(v.diagnosisName);
    setSecondary(v.secondaryDiagnoses ?? []);
    setNote(v.note ?? "");
    if (v.items.length > 0) applyRxItems(v.items);
  }, [applyRxItems]);

  // "Tạo lại đơn" từ một lần khám cụ thể (mở qua ?copyFrom=<visitId>).
  useEffect(() => {
    if (!copyFrom) return;
    loadFromVisit(copyFrom).catch(() => setError("Không tải được đơn cần tạo lại"));
  }, [copyFrom, loadFromVisit]);

  function updateItem(idx: number, patch: Partial<ItemForm>) {
    setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  /** Chèn 1 cụm ghi chú nhanh vào ô ghi chú (không trùng lặp). */
  function addQuickNote(term: string) {
    setNote((n) => {
      const t = n.trim();
      if (!t) return term;
      const parts = t.split(/[;,]/).map((s) => s.trim().toLowerCase());
      if (parts.includes(term.toLowerCase())) return n;
      return `${t}; ${term}`;
    });
  }

  /** Nút "Tạo lại đơn gần nhất" (§5.4) — copy CẢ chẩn đoán + thuốc từ lần khám gần nhất. */
  async function copyLast() {
    try {
      const visits = await api<VisitRow[]>(`/api/doctor/patients/${patientId}/visits`);
      if (visits.length === 0) {
        setError("Bệnh nhân chưa có đơn nào trước đó");
        return;
      }
      await loadFromVisit(visits[0].id); // đã sắp mới→cũ, phần tử đầu là gần nhất
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

  function toggleInfusion(checked: boolean) {
    setHasInfusionRow(checked);
    if (checked && !items.some((i) => i.infusion)) {
      setItems([...items, emptyItem(false, true)]);
    }
    if (!checked) {
      setItems(items.filter((i) => !i.infusion));
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!diagCode) {
      setError("Chẩn đoán ICD-10 là bắt buộc — chọn từ danh sách gợi ý");
      return;
    }
    const days = Number(numDays) || 0;
    // Có thuốc uống (chọn buổi) nhưng chưa nhập số ngày → tổng = 0, không trừ kho.
    const hasOralDose = items.some((it) => !it.injection && !it.infusion && it.medicineName.trim() && totalOf(it, 1) > 0);
    if (hasOralDose && days <= 0) {
      setError("Nhập số ngày uống ở cuối đơn thuốc");
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
          secondaryDiagnoses: secondary,
          note: note || null,
          clientRequestId,
          items: items
            .filter((it) => it.medicineName.trim())
            .map((it) => {
              // Tiêm/truyền: doseMorning = số ống/chai, không dùng số ngày; tổng = chính số đó.
              const perUnit = it.injection || it.infusion;
              return {
                medicineId: it.medicineId,
                medicineName: it.medicineName,
                doseMorning: Number(it.doseMorning) || 0,
                doseNoon: perUnit ? 0 : Number(it.doseNoon) || 0,
                doseAfternoon: perUnit ? 0 : Number(it.doseAfternoon) || 0,
                doseEvening: perUnit ? 0 : Number(it.doseEvening) || 0,
                specialDoseText: null,
                // Tiêm/truyền: mặc định "theo chỉ định"; chỉ khác đi khi bác sĩ tự ghi.
                usageNote: usageModeToNote(it.usageMode, it.usageCustom)
                  ?? fixedUsageNote(it.injection, it.infusion),
                numDays: perUnit ? null : days || null,
                // Thuốc uống: để backend tự tính = liều/ngày × số ngày.
                totalQuantityBase: perUnit ? Number(it.doseMorning) || 0 : null,
                injection: it.injection,
                infusion: it.infusion,
              };
            }),
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
        <h1 className="page-title">
          Lần khám mới {patient && <span className="text-blue-700">— {patient.fullName}</span>}
        </h1>
        <button
          type="button"
          onClick={copyLast}
          className="inline-flex items-center gap-2 text-sm border border-blue-300 text-blue-700 px-4 py-2 rounded-xl hover:bg-blue-50 transition font-medium"
        >
          <IconRefresh size={15} />
          Tạo lại đơn gần nhất
        </button>
      </div>

      {patient?.hasDrugAllergy && (
        <p className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <IconAlert size={15} />
          Bệnh nhân DỊ ỨNG THUỐC: {patient.drugAllergyNote || "(chưa ghi chú)"}
        </p>
      )}
      {patient?.hasChronicCondition && (
        <p className="flex items-center gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <IconAlert size={15} />
          Bệnh nền: {patient.chronicConditionNote || "(chưa ghi chú)"}
        </p>
      )}

      <div className="card p-5 space-y-4">
        <div>
          <label className="block text-sm mb-1.5 font-medium text-gray-600">Chẩn đoán chính (ICD-10) *</label>
          <IcdPicker code={diagCode} name={diagName} onPick={(c, n) => { setDiagCode(c); setDiagName(n); }} />
        </div>
        <div>
          <label className="block text-sm mb-1.5 font-medium text-gray-600">
            Chẩn đoán phụ <span className="text-gray-400 font-normal">(có thể nhiều mã)</span>
          </label>
          <IcdMultiPicker
            items={secondary}
            onAdd={(d) => setSecondary((s) => [...s, d])}
            onRemove={(code) => setSecondary((s) => s.filter((d) => d.code !== code))}
          />
        </div>
        <div>
          <label className="block text-sm mb-1.5 font-medium text-gray-600">Ghi chú khám</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="input"
          />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {QUICK_NOTES.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => addQuickNote(term)}
                className="text-xs border border-gray-300 rounded-full px-2.5 py-1 hover:bg-blue-50 hover:border-blue-300 text-gray-700"
              >
                + {term}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-semibold text-ink">Đơn thuốc</label>
          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={hasInjectionRow}
                onChange={(e) => toggleInjection(e.target.checked)}
              />
              <span className="text-purple-600"><IconSyringe size={15} /></span>
              Có tiêm thuốc
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={hasInfusionRow}
                onChange={(e) => toggleInfusion(e.target.checked)}
              />
              <span className="text-sky-600"><IconDroplet size={15} /></span>
              Có truyền dịch
            </label>
          </div>
        </div>

        <div className="space-y-4">
          {items.map((it, idx) => (
            <div key={idx} className={`border rounded-xl p-3 ${it.injection ? "border-purple-300 bg-purple-50/30" : it.infusion ? "border-sky-300 bg-sky-50/30" : "border-gray-200"}`}>
              <div className="flex items-start gap-2 flex-wrap">
                {it.injection && <span className="text-purple-600 py-2.5"><IconSyringe size={16} /></span>}
                {it.infusion && <span className="text-sky-600 py-2.5"><IconDroplet size={16} /></span>}
                <MedicineInput item={it} onChange={(p) => updateItem(idx, p)} />
                {it.injection || it.infusion ? (
                  <div className="text-center">
                    <input
                      type="number" min={0} step="any"
                      value={it.doseMorning}
                      onChange={(e) => updateItem(idx, { doseMorning: e.target.value })}
                      className="input-sm w-24 py-2 text-center"
                    />
                    <p className="text-[10px] text-gray-500">{it.injection ? "Số ống" : "Số chai"}</p>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    {SESSIONS.map(([f, label]) => {
                      const checked = it[f] !== "";
                      return (
                        <div key={f} className="text-center">
                          <label className="flex items-center gap-1 text-[11px] text-gray-600 cursor-pointer justify-center h-9">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => updateItem(idx, { [f]: e.target.checked ? "1" : "" })}
                            />
                            {label}
                          </label>
                          {checked && (
                            <input
                              type="number" min={0} step="any"
                              value={it[f]}
                              onChange={(e) => updateItem(idx, { [f]: e.target.value })}
                              className="input-sm w-14 px-1 text-center"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setItems(items.filter((_, i) => i !== idx))}
                    className="text-gray-400 hover:text-red-600 py-2.5 ml-auto transition-colors"
                    aria-label="Bỏ thuốc này"
                  >
                    <IconX size={16} />
                  </button>
                )}
              </div>
              <div className="flex gap-2 mt-2 flex-wrap items-center">
                <span className="text-xs text-gray-500">Cách dùng:</span>
                {/* Tiêm/truyền không dính dáng bữa ăn: bỏ trước/sau ăn, mặc định "theo
                    chỉ định", vẫn cho ghi chỉ định riêng (VD tiêm bắp, truyền chậm). */}
                {(it.injection || it.infusion) && (
                  <>
                    {it.usageMode !== "other" && (
                      <span className="text-xs font-medium text-gray-700">
                        {fixedUsageNote(it.injection, it.infusion)}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => updateItem(idx, {
                        usageMode: it.usageMode === "other" ? "" : "other",
                        usageCustom: "",
                      })}
                      className={`text-xs px-2.5 py-1 rounded-full border ${
                        it.usageMode === "other"
                          ? "bg-blue-600 text-white border-blue-600"
                          : "border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      Ghi riêng
                    </button>
                  </>
                )}
                {!it.injection && !it.infusion && USAGE_OPTIONS.map(([m, label]) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => updateItem(idx, { usageMode: it.usageMode === m ? "" : m })}
                    className={`text-xs px-2.5 py-1 rounded-full border ${
                      it.usageMode === m
                        ? "bg-blue-600 text-white border-blue-600"
                        : "border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
                {it.usageMode === "other" && (
                  <input
                    value={it.usageCustom}
                    onChange={(e) => updateItem(idx, { usageCustom: e.target.value })}
                    className="input-sm flex-1 min-w-40"
                    autoFocus
                  />
                )}
                {!it.injection && !it.infusion && totalOf(it, Number(numDays) || 0) > 0 && (
                  <span className="text-xs text-blue-700 font-medium ml-auto">
                    = {totalOf(it, Number(numDays) || 0)} {it.baseUnitLabel ?? "đơn vị"}
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

        <div className="flex items-center gap-2 mt-4 pt-4 border-t">
          <label className="text-sm font-medium">Số ngày uống (cả đơn):</label>
          <input
            type="number" min={1}
            value={numDays}
            onChange={(e) => setNumDays(e.target.value)}
            className="input-sm w-20 text-center"
          />
          <span className="text-xs text-gray-500">ngày — nhân với liều mỗi buổi để ra tổng thuốc trừ kho</span>
        </div>
      </div>

      {error && (
        <p className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          <IconAlert size={15} />
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <button type="submit" disabled={saving} className="btn-primary px-6">
          {saving ? "Đang lưu..." : "Lưu lần khám + đơn thuốc"}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-ghost">
          Hủy
        </button>
      </div>
      <p className="text-xs text-gray-500">Lưu đơn sẽ tự trừ kho theo tổng số lượng từng thuốc.</p>
    </form>
  );
}

export default function NewVisitPage(props: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="text-gray-500 py-8 text-center">Đang tải...</p>}>
      <NewVisitForm {...props} />
    </Suspense>
  );
}
