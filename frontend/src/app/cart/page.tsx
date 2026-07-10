"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getLocalCart, removeFromLocalCart } from "@/lib/cart";
import { formatVnd } from "@/lib/format";
import type { MedicinePublic } from "@/lib/types";

interface CartRow {
  medicine: MedicinePublic;
  quantity: number;
}

export default function CartPage() {
  const [rows, setRows] = useState<CartRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const cart = getLocalCart();
    const results = await Promise.allSettled(
      cart.map((item) => api<MedicinePublic>(`/api/public/medicines/${item.medicineId}`))
    );
    const next: CartRow[] = [];
    results.forEach((r, i) => {
      if (r.status === "fulfilled") {
        next.push({ medicine: r.value, quantity: cart[i].quantity });
      } else {
        // thuốc đã bị ẩn/xóa khỏi cửa hàng → dọn khỏi giỏ
        removeFromLocalCart(cart[i].medicineId);
      }
    });
    setRows(next);
    setLoading(false);
  }

  useEffect(() => {
    load();
    window.addEventListener("cart-changed", load);
    return () => window.removeEventListener("cart-changed", load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = rows.reduce((s, r) => s + r.medicine.salePrice * r.quantity, 0);

  if (loading) return <p className="text-gray-500 py-8 text-center">Đang tải...</p>;

  if (rows.length === 0) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-gray-500">Giỏ hàng trống.</p>
        <Link href="/medicines" className="text-emerald-700 hover:underline">
          Xem cửa hàng thuốc →
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Giỏ hàng</h1>
      <div className="bg-white border rounded-xl divide-y">
        {rows.map((r) => (
          <div key={r.medicine.id} className="flex items-center gap-4 p-4">
            <div className="w-14 h-14 bg-gray-100 rounded-lg relative overflow-hidden shrink-0">
              {r.medicine.imageUrl ? (
                <Image src={r.medicine.imageUrl} alt={r.medicine.name} fill className="object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl">💊</div>
              )}
            </div>
            <div className="flex-1">
              <Link
                href={`/medicines/${r.medicine.id}`}
                className="font-medium hover:text-emerald-700"
              >
                {r.medicine.name}
              </Link>
              <p className="text-sm text-gray-600">
                {formatVnd(r.medicine.salePrice)} × {r.quantity}
              </p>
            </div>
            <div className="font-semibold text-sm">
              {formatVnd(r.medicine.salePrice * r.quantity)}
            </div>
            <button
              onClick={() => removeFromLocalCart(r.medicine.id)}
              className="text-red-600 text-sm hover:underline"
            >
              Xóa
            </button>
          </div>
        ))}
        <div className="flex justify-between items-center p-4 font-bold">
          <span>Tổng cộng</span>
          <span className="text-emerald-700">{formatVnd(total)}</span>
        </div>
      </div>
      <button
        disabled
        title="Chức năng đặt hàng sẽ có ở bước tiếp theo"
        className="mt-4 w-full bg-gray-300 text-gray-600 py-2.5 rounded-lg cursor-not-allowed"
      >
        Đặt hàng (sắp ra mắt)
      </button>
      <p className="text-xs text-gray-500 mt-2 text-center">
        Nhận thuốc trực tiếp tại phòng khám — thanh toán tại quầy.
      </p>
    </div>
  );
}
