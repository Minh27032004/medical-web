"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { clearLocalCart, getLocalCart, removeFromLocalCart } from "@/lib/cart";
import { createSupabaseClient } from "@/lib/supabase";
import { formatVnd } from "@/lib/format";
import type { MedicinePublic, Order } from "@/lib/types";

interface CartRow {
  medicine: MedicinePublic;
  quantity: number;
}

export default function CartPage() {
  const router = useRouter();
  const [rows, setRows] = useState<CartRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);

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

  async function placeOrder() {
    setOrderError("");
    const supabase = createSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      router.push("/login?next=/cart");
      return;
    }
    setPlacing(true);
    try {
      const order = await api<Order>("/api/me/orders", {
        method: "POST",
        body: JSON.stringify({
          items: rows.map((r) => ({
            medicineId: r.medicine.id,
            quantity: r.quantity,
          })),
        }),
      });
      clearLocalCart();
      setPlacedOrder(order);
    } catch (err) {
      setOrderError(err instanceof ApiError ? err.message : "Đặt hàng thất bại, thử lại sau");
    } finally {
      setPlacing(false);
    }
  }

  if (placedOrder) {
    return (
      <div className="max-w-md mx-auto text-center py-12 space-y-4">
        <div className="text-5xl">✅</div>
        <h1 className="text-xl font-bold">Đặt hàng thành công!</h1>
        <p className="text-gray-600">Mã nhận hàng của bạn:</p>
        <p className="text-4xl font-mono font-bold tracking-widest text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl py-4">
          {placedOrder.pickupCode}
        </p>
        <p className="text-sm text-gray-600">
          Đưa mã này cho bác sĩ khi đến phòng khám nhận thuốc và thanh toán tại quầy
          ({formatVnd(placedOrder.totalAmount)}).
        </p>
        <Link href="/account/orders" className="inline-block text-emerald-700 hover:underline">
          Xem đơn hàng của tôi →
        </Link>
      </div>
    );
  }

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
      {orderError && <p className="text-red-600 text-sm mt-3 text-center">{orderError}</p>}
      <button
        onClick={placeOrder}
        disabled={placing}
        className="mt-4 w-full bg-emerald-600 text-white py-2.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
      >
        {placing ? "Đang đặt hàng..." : "Đặt hàng"}
      </button>
      <p className="text-xs text-gray-500 mt-2 text-center">
        Nhận thuốc trực tiếp tại phòng khám — thanh toán tại quầy.
      </p>
    </div>
  );
}
