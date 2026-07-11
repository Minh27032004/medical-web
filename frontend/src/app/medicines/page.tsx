"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { addToLocalCart } from "@/lib/cart";
import { formatVnd } from "@/lib/format";
import type { MedicinePublic, Page } from "@/lib/types";

export default function MedicinesPage() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<MedicinePublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [added, setAdded] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      api<Page<MedicinePublic>>(
        `/api/public/medicines?q=${encodeURIComponent(q)}&size=40`
      )
        .then((page) => {
          setItems(page.content);
          setError("");
        })
        .catch(() => setError("Không tải được danh sách thuốc"))
        .finally(() => setLoading(false));
    }, 300); // debounce khi gõ tìm kiếm
    return () => clearTimeout(timer);
  }, [q]);

  function handleAdd(id: string) {
    addToLocalCart(id);
    setAdded(id);
    setTimeout(() => setAdded(null), 1200);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-4">
        <h1 className="text-xl font-bold">Cửa hàng thuốc</h1>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm thuốc..."
          className="border rounded-lg px-3 py-2 w-56 text-sm"
        />
      </div>

      {loading && <p className="text-gray-500 py-8 text-center">Đang tải...</p>}
      {error && <p className="text-red-600 py-8 text-center">{error}</p>}
      {!loading && !error && items.length === 0 && (
        <p className="text-gray-500 py-8 text-center">Không có thuốc nào.</p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {items.map((m) => (
          <div key={m.id} className="bg-white border rounded-xl overflow-hidden flex flex-col">
            <Link href={`/medicines/${m.id}`} className="block">
              <div className="aspect-square bg-gray-100 relative">
                {m.imageUrl ? (
                  <Image src={m.imageUrl} alt={m.name} fill className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl">💊</div>
                )}
              </div>
            </Link>
            <div className="p-3 flex flex-col gap-1 flex-1">
              <Link
                href={`/medicines/${m.id}`}
                className="font-medium text-sm hover:text-blue-700 line-clamp-2"
              >
                {m.name}
              </Link>
              <div className="text-blue-700 font-semibold text-sm mt-auto">
                {formatVnd(m.salePrice)}
              </div>
              <button
                onClick={() => handleAdd(m.id)}
                className="mt-1 text-sm border border-blue-600 text-blue-700 rounded-lg py-1.5 hover:bg-blue-50"
              >
                {added === m.id ? "✓ Đã thêm" : "Thêm vào giỏ"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
