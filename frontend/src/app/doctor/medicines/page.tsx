"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatDate, formatVnd } from "@/lib/format";
import type { MedicineDoctor, Page } from "@/lib/types";

export default function DoctorMedicinesPage() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<MedicineDoctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api<Page<MedicineDoctor>>(
      `/api/doctor/medicines?q=${encodeURIComponent(q)}&size=100`
    )
      .then((page) => {
        setItems(page.content);
        setError("");
      })
      .catch(() => setError("Không tải được kho thuốc (bạn có đang đăng nhập bằng tài khoản bác sĩ?)"))
      .finally(() => setLoading(false));
  }, [q]);

  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [load]);

  async function toggleStock(m: MedicineDoctor) {
    await api(`/api/doctor/medicines/${m.id}`, {
      method: "PUT",
      body: JSON.stringify({
        name: m.name,
        description: m.description,
        imagePath: m.imagePath,
        costPrice: m.costPrice,
        salePrice: m.salePrice,
        expiryDate: m.expiryDate,
        inStock: !m.inStock,
      }),
    });
    load();
  }

  async function remove(m: MedicineDoctor) {
    if (!confirm(`Xóa "${m.name}" khỏi kho? (đơn thuốc cũ vẫn giữ được lịch sử)`)) return;
    await api(`/api/doctor/medicines/${m.id}`, { method: "DELETE" });
    load();
  }

  const isExpired = (m: MedicineDoctor) =>
    m.expiryDate !== null && new Date(m.expiryDate) < new Date();

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <h1 className="text-xl font-bold">Kho thuốc</h1>
        <div className="flex gap-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm thuốc..."
            className="border rounded-lg px-3 py-2 w-52 text-sm"
          />
          <Link
            href="/doctor/medicines/new"
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700"
          >
            + Thêm thuốc
          </Link>
        </div>
      </div>

      {loading && <p className="text-gray-500 py-8 text-center">Đang tải...</p>}
      {error && <p className="text-red-600 py-8 text-center">{error}</p>}
      {!loading && !error && items.length === 0 && (
        <p className="text-gray-500 py-8 text-center">
          Kho trống — bấm &quot;+ Thêm thuốc&quot; để bắt đầu.
        </p>
      )}

      {items.length > 0 && (
        <div className="bg-white border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="p-3">Thuốc</th>
                <th className="p-3">Giá gốc</th>
                <th className="p-3">Giá bán</th>
                <th className="p-3">HSD</th>
                <th className="p-3">Trạng thái</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((m) => (
                <tr key={m.id} className={isExpired(m) ? "bg-red-50" : ""}>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded relative overflow-hidden shrink-0">
                        {m.imageUrl ? (
                          <Image src={m.imageUrl} alt={m.name} fill className="object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">💊</div>
                        )}
                      </div>
                      <span className="font-medium">{m.name}</span>
                    </div>
                  </td>
                  <td className="p-3">{formatVnd(m.costPrice)}</td>
                  <td className="p-3">{formatVnd(m.salePrice)}</td>
                  <td className="p-3">
                    {formatDate(m.expiryDate)}
                    {isExpired(m) && (
                      <span className="ml-1 text-red-600 text-xs font-medium">hết hạn</span>
                    )}
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => toggleStock(m)}
                      className={
                        m.inStock
                          ? "text-emerald-700 bg-emerald-50 px-2 py-1 rounded text-xs"
                          : "text-gray-500 bg-gray-100 px-2 py-1 rounded text-xs"
                      }
                    >
                      {m.inStock ? "Còn hàng" : "Hết hàng"}
                    </button>
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <Link
                      href={`/doctor/medicines/${m.id}/edit`}
                      className="text-emerald-700 hover:underline mr-3"
                    >
                      Sửa
                    </Link>
                    <button onClick={() => remove(m)} className="text-red-600 hover:underline">
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
