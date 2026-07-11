"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { api, apiForm, ApiError } from "@/lib/api";
import type { Patient } from "@/lib/types";

export default function PatientForm({ initial }: { initial?: Patient }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [fullName, setFullName] = useState(initial?.fullName ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [age, setAge] = useState(initial?.age?.toString() ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState(initial?.photoUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
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
      setPhotoPath(res.path);
      setPhotoUrl(res.url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload ảnh thất bại");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const body = JSON.stringify({
      fullName,
      phone: phone || null,
      age: age ? Number(age) : null,
      // giữ ảnh cũ nếu không đổi: backend nhận path, không nhận URL
      photoPath: photoPath ?? undefined,
      note: note || null,
      // liên kết tài khoản khi tạo từ lịch hẹn (?profileId=...)
      profileId: initial?.profileId ?? searchParams.get("profileId") ?? null,
    });
    try {
      const saved = initial
        ? await api<Patient>(`/api/doctor/patients/${initial.id}`, { method: "PUT", body })
        : await api<Patient>("/api/doctor/patients", { method: "POST", body });
      router.push(`/doctor/patients/${saved.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Lưu thất bại");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-4 bg-white border rounded-xl p-6">
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 bg-gray-100 rounded-full overflow-hidden shrink-0">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="Ảnh bệnh nhân" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl">🧑</div>
          )}
        </div>
        <label className="text-sm border rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-50">
          {uploading ? "Đang tải..." : "Chọn ảnh"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handlePhoto}
            className="hidden"
            disabled={uploading}
          />
        </label>
      </div>

      <div>
        <label className="block text-sm mb-1 font-medium">Họ tên *</label>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full border rounded-lg px-3 py-2"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm mb-1 font-medium">Số điện thoại</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm mb-1 font-medium">Tuổi</label>
          <input
            type="number"
            min={0}
            max={150}
            value={age}
            onChange={(e) => setAge(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm mb-1 font-medium">Ghi chú</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="w-full border rounded-lg px-3 py-2"
        />
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving || uploading}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Đang lưu..." : initial ? "Cập nhật" : "Tạo hồ sơ"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="border px-5 py-2.5 rounded-lg hover:bg-gray-50"
        >
          Hủy
        </button>
      </div>
    </form>
  );
}
