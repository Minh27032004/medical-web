"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconAlert } from "@/components/ui";
import { invalidate } from "@/hooks/useApiData";
import { api, ApiError } from "@/lib/api";
import type { Patient } from "@/lib/types";

/**
 * Form bệnh nhân — dị ứng/bệnh nền là checkbox, tick mới hiện ô nhập (§5.2).
 *
 * onSaved: dùng khi form nằm NGAY TRONG trang hồ sơ (sửa tại chỗ). Không có nó thì
 * form tự điều hướng sang trang hồ sơ — chỉ đúng cho luồng tạo mới.
 */
export default function PatientForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: Patient;
  onSaved?: (saved: Patient) => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    fullName: initial?.fullName ?? "",
    phone: initial?.phone ?? "",
    gender: initial?.gender ?? "",
    age: initial?.age != null ? String(initial.age) : "",
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
    // Tuổi để trống = null (không ghi), KHÔNG phải 0.
    const body = JSON.stringify({
      ...form,
      gender: form.gender || null,
      age: form.age.trim() === "" ? null : Number(form.age),
    });
    try {
      const saved = initial
        ? await api<Patient>(`/api/doctor/patients/${initial.id}`, { method: "PUT", body })
        : await api<Patient>("/api/doctor/patients", { method: "POST", body });
      // Danh sách bệnh nhân có cache — không xóa thì vừa thêm xong quay ra vẫn thấy bản cũ.
      invalidate("/api/doctor/patients");
      if (onSaved) {
        // Sửa tại chỗ: router.push tới ĐÚNG url đang đứng không điều hướng đi đâu cả,
        // component không unmount nên nút kẹt vĩnh viễn ở "Đang lưu...". Trả về cho
        // trang cha tự đóng form và tải lại dữ liệu.
        setSaving(false);
        onSaved(saved);
        return;
      }
      router.push(`/patients/${saved.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Lưu thất bại");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-lg card p-6 space-y-4">
      <div>
        <label className="block text-sm mb-1.5 font-medium text-gray-600">Họ tên *</label>
        <input
          value={form.fullName}
          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          className="input"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm mb-1.5 font-medium text-gray-600">Số điện thoại</label>
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="input"
          />
        </div>
        <div>
          <label className="block text-sm mb-1.5 font-medium text-gray-600">Giới tính</label>
          <select
            value={form.gender}
            onChange={(e) => setForm({ ...form, gender: e.target.value })}
            className="input"
          >
            <option value="">—</option>
            <option value="male">Nam</option>
            <option value="female">Nữ</option>
            <option value="other">Khác</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm mb-1.5 font-medium text-gray-600">
          Tuổi <span className="font-normal text-gray-400">(có thể bỏ trống)</span>
        </label>
        <input
          type="number"
          min={0}
          max={150}
          inputMode="numeric"
          value={form.age}
          onChange={(e) => setForm({ ...form, age: e.target.value })}
          className="input"
          placeholder="VD: 45"
        />
      </div>

      <div className="border border-gray-200 rounded-xl p-3 bg-red-50/40">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={form.hasDrugAllergy}
            onChange={(e) => setForm({ ...form, hasDrugAllergy: e.target.checked })}
          />
          <span className="text-red-600"><IconAlert size={15} /></span>
          Có dị ứng thuốc
        </label>
        {form.hasDrugAllergy && (
          <input
            value={form.drugAllergyNote}
            onChange={(e) => setForm({ ...form, drugAllergyNote: e.target.value })}
            placeholder="Dị ứng thuốc gì? Biểu hiện?"
            className="input mt-2"
          />
        )}
      </div>

      <div className="border border-gray-200 rounded-xl p-3 bg-amber-50/40">
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
            className="input mt-2"
          />
        )}
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? "Đang lưu..." : initial ? "Cập nhật" : "Tạo bệnh nhân"}
        </button>
        <button
          type="button"
          onClick={() => (onCancel ? onCancel() : router.back())}
          className="btn-ghost"
        >
          Hủy
        </button>
      </div>
    </form>
  );
}
