"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { api, apiForm, ApiError } from "@/lib/api";
import { formatVnd } from "@/lib/format";
import type { MedicineSuggestion, Patient } from "@/lib/types";

interface ItemRow {
  medicineId: string | null;
  medicineName: string;
  quantity: number;
  dosage: string;
  salePrice: number | null; // hiển thị khi chọn từ kho
  costPrice: string; // nhập tay khi thuốc ngoài kho
  manualSalePrice: string;
}

interface UploadedImage {
  path: string;
  url: string;
  kind: "XRAY" | "ECG" | "OTHER";
}

const emptyRow = (): ItemRow => ({
  medicineId: null,
  medicineName: "",
  quantity: 1,
  dosage: "",
  salePrice: null,
  costPrice: "",
  manualSalePrice: "",
});

/** Ô nhập thuốc có autocomplete trực quan (ảnh + tên + giá) từ kho của bác sĩ. */
function MedicineInput({
  row,
  onChange,
}: {
  row: ItemRow;
  onChange: (patch: Partial<ItemRow>) => void;
}) {
  const [suggestions, setSuggestions] = useState<MedicineSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = row.medicineName.trim();
    if (!q || row.medicineId) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      api<MedicineSuggestion[]>(`/api/doctor/medicines/suggest?q=${encodeURIComponent(q)}`)
        .then((s) => {
          setSuggestions(s);
          setOpen(s.length > 0);
        })
        .catch(() => setSuggestions([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [row.medicineName, row.medicineId]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={wrapRef} className="relative flex-1 min-w-40">
      <input
        value={row.medicineName}
        onChange={(e) =>
          onChange({ medicineName: e.target.value, medicineId: null, salePrice: null })
        }
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder="Tên thuốc..."
        className="w-full border rounded-lg px-3 py-2 text-sm"
        required
      />
      {open && (
        <div className="absolute z-20 top-full left-0 right-0 bg-white border rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto">
          {suggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                onChange({ medicineId: s.id, medicineName: s.name, salePrice: s.salePrice });
                setOpen(false);
              }}
              className="w-full flex items-center gap-3 p-2 hover:bg-blue-50 text-left"
            >
              <div className="w-9 h-9 bg-gray-100 rounded overflow-hidden shrink-0">
                {s.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.imageUrl} alt={s.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">💊</div>
                )}
              </div>
              <span className="text-sm flex-1">{s.name}</span>
              <span className="text-xs text-blue-700">{formatVnd(s.salePrice)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PrescriptionForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const patientId = searchParams.get("patientId");
  const appointmentId = searchParams.get("appointmentId");

  const [patient, setPatient] = useState<Patient | null>(null);
  const [symptoms, setSymptoms] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [examFee, setExamFee] = useState("");
  const [rows, setRows] = useState<ItemRow[]>([emptyRow()]);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [imageKind, setImageKind] = useState<"XRAY" | "ECG" | "OTHER">("OTHER");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!patientId) return;
    api<Patient>(`/api/doctor/patients/${patientId}`).then(setPatient).catch(() => {});
  }, [patientId]);

  function updateRow(idx: number, patch: Partial<ItemRow>) {
    setRows(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  async function uploadImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiForm<{ path: string; url: string }>(
        "/api/doctor/uploads/medical-image",
        formData
      );
      setImages([...images, { ...res, kind: imageKind }]);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Upload thất bại");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!patientId) return;
    setSaving(true);
    setError("");
    try {
      await api("/api/doctor/prescriptions", {
        method: "POST",
        body: JSON.stringify({
          patientId,
          appointmentId: appointmentId || null,
          symptoms: symptoms || null,
          diagnosis: diagnosis || null,
          examFee: examFee ? Number(examFee) : 0,
          items: rows
            .filter((r) => r.medicineName.trim())
            .map((r) => ({
              medicineId: r.medicineId,
              medicineName: r.medicineName,
              quantity: r.quantity,
              dosage: r.dosage || null,
              costPrice: r.medicineId ? null : Number(r.costPrice || 0),
              salePrice: r.medicineId ? null : Number(r.manualSalePrice || 0),
            })),
          images: images.map((i) => ({ imagePath: i.path, kind: i.kind })),
        }),
      });
      router.push(`/doctor/patients/${patientId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Lưu đơn thuốc thất bại");
      setSaving(false);
    }
  }

  if (!patientId) {
    return (
      <p className="text-red-600 py-8 text-center">
        Thiếu bệnh nhân — hãy vào hồ sơ bệnh nhân rồi bấm &quot;Tạo đơn thuốc&quot;.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-5">
      <h1 className="text-xl font-bold">
        Tạo đơn thuốc {patient && <span className="text-blue-700">— {patient.fullName}</span>}
      </h1>

      <div className="bg-white border rounded-xl p-5 space-y-4">
        <div>
          <label className="block text-sm mb-1 font-medium">Triệu chứng bệnh</label>
          <textarea
            value={symptoms}
            onChange={(e) => setSymptoms(e.target.value)}
            rows={2}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm mb-1 font-medium">Chẩn đoán</label>
          <textarea
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
            rows={2}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm mb-1 font-medium">Tiền công khám (₫)</label>
          <input
            type="number"
            min={0}
            value={examFee}
            onChange={(e) => setExamFee(e.target.value)}
            className="w-48 border rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm mb-1 font-medium">Ảnh bệnh (X-quang, điện tim...)</label>
          <div className="flex items-center gap-3 flex-wrap">
            {images.map((img, idx) => (
              <div key={idx} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.kind} className="w-20 h-20 object-cover rounded-lg border" />
                <button
                  type="button"
                  onClick={() => setImages(images.filter((_, i) => i !== idx))}
                  className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 text-xs"
                >
                  ×
                </button>
                <p className="text-xs text-center text-gray-500">
                  {img.kind === "XRAY" ? "X-quang" : img.kind === "ECG" ? "Điện tim" : "Khác"}
                </p>
              </div>
            ))}
            <div className="flex flex-col gap-1">
              <select
                value={imageKind}
                onChange={(e) => setImageKind(e.target.value as UploadedImage["kind"])}
                className="border rounded-lg px-2 py-1.5 text-sm"
              >
                <option value="XRAY">X-quang</option>
                <option value="ECG">Điện tim</option>
                <option value="OTHER">Khác</option>
              </select>
              <label className="text-sm border rounded-lg px-3 py-1.5 cursor-pointer hover:bg-gray-50 text-center">
                {uploading ? "Đang tải..." : "+ Ảnh"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={uploadImage}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-xl p-5">
        <label className="block text-sm mb-3 font-medium">Đơn thuốc</label>
        <div className="space-y-3">
          {rows.map((r, idx) => (
            <div key={idx} className="flex items-start gap-2 flex-wrap">
              <MedicineInput row={r} onChange={(patch) => updateRow(idx, patch)} />
              <input
                type="number"
                min={1}
                value={r.quantity}
                onChange={(e) => updateRow(idx, { quantity: Math.max(1, Number(e.target.value)) })}
                className="w-16 border rounded-lg px-2 py-2 text-sm"
                title="Số lượng"
              />
              <input
                value={r.dosage}
                onChange={(e) => updateRow(idx, { dosage: e.target.value })}
                placeholder="Liều dùng..."
                className="w-40 border rounded-lg px-3 py-2 text-sm"
              />
              {r.medicineId ? (
                <span className="text-sm text-blue-700 py-2 w-24 text-right">
                  {r.salePrice != null && formatVnd(r.salePrice * r.quantity)}
                </span>
              ) : r.medicineName.trim() ? (
                <div className="flex gap-1">
                  <input
                    type="number"
                    min={0}
                    value={r.costPrice}
                    onChange={(e) => updateRow(idx, { costPrice: e.target.value })}
                    placeholder="Giá gốc"
                    className="w-20 border rounded-lg px-2 py-2 text-sm"
                    title="Giá gốc (thuốc ngoài kho)"
                  />
                  <input
                    type="number"
                    min={0}
                    value={r.manualSalePrice}
                    onChange={(e) => updateRow(idx, { manualSalePrice: e.target.value })}
                    placeholder="Giá bán"
                    className="w-20 border rounded-lg px-2 py-2 text-sm"
                    title="Giá bán (thuốc ngoài kho)"
                  />
                </div>
              ) : null}
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => setRows(rows.filter((_, i) => i !== idx))}
                  className="text-red-600 py-2 text-sm"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setRows([...rows, emptyRow()])}
          className="mt-3 text-sm border border-dashed border-blue-400 text-blue-700 rounded-lg px-4 py-2 hover:bg-blue-50 w-full"
        >
          + Thêm thuốc
        </button>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving || uploading}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Đang lưu..." : "Lưu đơn thuốc"}
        </button>
        <button type="button" onClick={() => router.back()} className="border px-5 py-2.5 rounded-lg hover:bg-gray-50">
          Hủy
        </button>
      </div>
    </form>
  );
}

export default function NewPrescriptionPage() {
  return (
    <Suspense>
      <PrescriptionForm />
    </Suspense>
  );
}
