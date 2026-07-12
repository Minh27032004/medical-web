"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Patient } from "@/lib/types";

/** Form bệnh nhân — dị ứng/bệnh nền là checkbox, tick mới hiện ô nhập (§5.2). */
export default function PatientForm({ initial }: { initial?: Patient }) {
  const router = useRouter();
  const [form, setForm] = useState({
    fullName: initial?.fullName ?? "",
    phone: initial?.phone ?? "",
    gender: initial?.gender ?? "",
    address: initial?.address ?? "",
    hasDrugAllergy: initial?.hasDrugAllergy ?? false,
    drugAllergyNote: initial?.drugAllergyNote ?? "",
    hasChronicCondition: initial?.hasChronicCondition ?? false,
    chronicConditionNote: initial?.chronicConditionNote ?? "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const body = JSON.stringify({ ...form, gender: form.gender || null });
    try {
      const saved = initial
        ? await api<Patient>(`/api/doctor/patients/${initial.id}`, { method: "PUT", body })
        : await api<Patient>("/api/doctor/patients", { method: "POST", body });
      router.push(`/patients/${saved.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Lưu thất bại");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-lg bg-white border rounded-xl p-6 space-y-4">
      <div>
        <label className="block text-sm mb-1 font-medium">Họ tên *</label>
        <input
          value={form.fullName}
          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          className="w-full border rounded-lg px-3 py-2"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm mb-1 font-medium">Số điện thoại</label>
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm mb-1 font-medium">Giới tính</label>
          <select
            value={form.gender}
            onChange={(e) => setForm({ ...form, gender: e.target.value })}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="">—</option>
            <option value="male">Nam</option>
            <option value="female">Nữ</option>
            <option value="other">Khác</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm mb-1 font-medium">Địa chỉ</label>
        <input
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          className="w-full border rounded-lg px-3 py-2"
        />
      </div>

      <div className="border rounded-lg p-3 bg-red-50/40">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={form.hasDrugAllergy}
            onChange={(e) => setForm({ ...form, hasDrugAllergy: e.target.checked })}
          />
          ⚠ Có dị ứng thuốc
        </label>
        {form.hasDrugAllergy && (
          <input
            value={form.drugAllergyNote}
            onChange={(e) => setForm({ ...form, drugAllergyNote: e.target.value })}
            placeholder="Dị ứng thuốc gì? Biểu hiện?"
            className="w-full border rounded-lg px-3 py-2 mt-2 text-sm"
          />
        )}
      </div>

      <div className="border rounded-lg p-3 bg-amber-50/40">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={form.hasChronicCondition}
            onChange={(e) => setForm({ ...form, hasChronicCondition: e.target.checked })}
          />
          Có bệnh nền
        </label>
        {form.hasChronicCondition && (
          <input
            value={form.chronicConditionNote}
            onChange={(e) => setForm({ ...form, chronicConditionNote: e.target.value })}
            placeholder="Bệnh nền gì? Đang dùng thuốc gì?"
            className="w-full border rounded-lg px-3 py-2 mt-2 text-sm"
          />
        )}
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Đang lưu..." : initial ? "Cập nhật" : "Tạo bệnh nhân"}
        </button>
        <button type="button" onClick={() => router.back()} className="border px-5 py-2.5 rounded-lg hover:bg-gray-50">
          Hủy
        </button>
      </div>
    </form>
  );
}
