"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, apiForm, ApiError } from "@/lib/api";
import type { MedicineDoctor } from "@/lib/types";

interface Props {
  initial?: MedicineDoctor; // có = sửa, không có = thêm mới
}

export default function MedicineForm({ initial }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [costPrice, setCostPrice] = useState(initial?.costPrice?.toString() ?? "");
  const [salePrice, setSalePrice] = useState(initial?.salePrice?.toString() ?? "");
  const [expiryDate, setExpiryDate] = useState(initial?.expiryDate ?? "");
  const [inStock, setInStock] = useState(initial?.inStock ?? true);
  const [imagePath, setImagePath] = useState(initial?.imagePath ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiForm<{ path: string; url: string }>(
        "/api/doctor/uploads/medicine-image",
        formData
      );
      setImagePath(res.path);
      setImageUrl(res.url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload ảnh thất bại");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const body = JSON.stringify({
      name,
      description: description || null,
      imagePath: imagePath || null,
      costPrice: Number(costPrice),
      salePrice: Number(salePrice),
      expiryDate: expiryDate || null,
      inStock,
    });
    try {
      if (initial) {
        await api(`/api/doctor/medicines/${initial.id}`, { method: "PUT", body });
      } else {
        await api("/api/doctor/medicines", { method: "POST", body });
      }
      router.push("/doctor/medicines");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Lưu thất bại");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-4 bg-white border rounded-xl p-6">
      <div>
        <label className="block text-sm mb-1 font-medium">Tên thuốc *</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border rounded-lg px-3 py-2"
          required
        />
      </div>

      <div>
        <label className="block text-sm mb-1 font-medium">Ảnh chụp</label>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 bg-gray-100 rounded-lg relative overflow-hidden shrink-0">
            {imageUrl ? (
              <Image src={imageUrl} alt="Ảnh thuốc" fill className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl">💊</div>
            )}
          </div>
          <label className="text-sm border rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-50">
            {uploading ? "Đang tải lên..." : "Chọn ảnh"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImage}
              className="hidden"
              disabled={uploading}
            />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm mb-1 font-medium">Giá gốc (₫) *</label>
          <input
            type="number"
            min={0}
            value={costPrice}
            onChange={(e) => setCostPrice(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
            required
          />
        </div>
        <div>
          <label className="block text-sm mb-1 font-medium">Giá bán (₫) *</label>
          <input
            type="number"
            min={0}
            value={salePrice}
            onChange={(e) => setSalePrice(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-sm mb-1 font-medium">Hạn sử dụng</label>
        <input
          type="date"
          value={expiryDate}
          onChange={(e) => setExpiryDate(e.target.value)}
          className="w-full border rounded-lg px-3 py-2"
        />
      </div>

      <div>
        <label className="block text-sm mb-1 font-medium">Mô tả</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full border rounded-lg px-3 py-2"
          rows={3}
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={inStock}
          onChange={(e) => setInStock(e.target.checked)}
        />
        Còn hàng (hiển thị trên cửa hàng)
      </label>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving || uploading}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Đang lưu..." : initial ? "Cập nhật" : "Thêm thuốc"}
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
