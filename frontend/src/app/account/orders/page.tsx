"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { formatVnd } from "@/lib/format";
import {
  ORDER_STATUS_COLOR,
  ORDER_STATUS_LABEL,
  type Order,
  type Page,
} from "@/lib/types";

export default function MyOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api<Page<Order>>("/api/me/orders?size=20")
      .then((page) => setOrders(page.content))
      .catch(() => setError("Không tải được danh sách đơn hàng"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  async function cancel(order: Order) {
    if (!confirm(`Hủy đơn ${order.pickupCode}?`)) return;
    try {
      await api(`/api/me/orders/${order.id}/cancel`, { method: "POST" });
      load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Hủy thất bại");
    }
  }

  if (loading) return <p className="text-gray-500 py-8 text-center">Đang tải...</p>;
  if (error) return <p className="text-red-600 py-8 text-center">{error}</p>;

  if (orders.length === 0) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-gray-500">Bạn chưa có đơn hàng nào.</p>
        <Link href="/medicines" className="text-emerald-700 hover:underline">
          Xem cửa hàng thuốc →
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Đơn hàng của tôi</h1>
      <div className="space-y-4">
        {orders.map((o) => (
          <div key={o.id} className="bg-white border rounded-xl p-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-lg tracking-wider">
                  {o.pickupCode}
                </span>
                <span className={`text-xs px-2 py-1 rounded ${ORDER_STATUS_COLOR[o.status]}`}>
                  {ORDER_STATUS_LABEL[o.status]}
                </span>
              </div>
              <span className="text-sm text-gray-500">
                {new Date(o.createdAt).toLocaleString("vi-VN")}
              </span>
            </div>
            <ul className="mt-3 text-sm text-gray-700 space-y-1">
              {o.items.map((i, idx) => (
                <li key={idx} className="flex justify-between">
                  <span>
                    {i.medicineName} × {i.quantity}
                  </span>
                  <span>{formatVnd(i.salePrice * i.quantity)}</span>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between mt-3 pt-3 border-t">
              <span className="font-semibold">
                Tổng: <span className="text-emerald-700">{formatVnd(o.totalAmount)}</span>
              </span>
              {o.status === "PENDING" && (
                <button onClick={() => cancel(o)} className="text-red-600 text-sm hover:underline">
                  Hủy đơn
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
