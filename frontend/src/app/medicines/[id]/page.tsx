"use client";

import Image from "next/image";
import { use, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { addToLocalCart } from "@/lib/cart";
import { formatDate, formatVnd } from "@/lib/format";
import type { MedicinePublic } from "@/lib/types";

export default function MedicineDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [medicine, setMedicine] = useState<MedicinePublic | null>(null);
  const [error, setError] = useState("");
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    api<MedicinePublic>(`/api/public/medicines/${id}`)
      .then(setMedicine)
      .catch(() => setError("Không tìm thấy thuốc này"));
  }, [id]);

  if (error) return <p className="text-red-600 py-8 text-center">{error}</p>;
  if (!medicine) return <p className="text-gray-500 py-8 text-center">Đang tải...</p>;

  function handleAdd() {
    addToLocalCart(id, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  }

  return (
    <div className="grid md:grid-cols-2 gap-8 bg-white border rounded-xl p-6">
      <div className="aspect-square bg-gray-100 rounded-lg relative overflow-hidden">
        {medicine.imageUrl ? (
          <Image src={medicine.imageUrl} alt={medicine.name} fill className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-7xl">💊</div>
        )}
      </div>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{medicine.name}</h1>
        <p className="text-2xl text-blue-700 font-semibold">
          {formatVnd(medicine.salePrice)}
        </p>
        {medicine.expiryDate && (
          <p className="text-sm text-gray-600">
            Hạn sử dụng: {formatDate(medicine.expiryDate)}
          </p>
        )}
        {medicine.description && (
          <p className="text-gray-700 whitespace-pre-line">{medicine.description}</p>
        )}
        <div className="flex items-center gap-3">
          <label className="text-sm">Số lượng</label>
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
            className="border rounded-lg px-3 py-2 w-20"
          />
        </div>
        <button
          onClick={handleAdd}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700"
        >
          {added ? "✓ Đã thêm vào giỏ" : "Thêm vào giỏ hàng"}
        </button>
        <p className="text-xs text-gray-500">
          💡 Thuốc nhận trực tiếp tại phòng khám, không giao hàng.
        </p>
      </div>
    </div>
  );
}
