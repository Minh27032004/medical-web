"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { formatVnd } from "@/lib/format";
import {
  ORDER_STATUS_COLOR,
  ORDER_STATUS_LABEL,
  type Order,
  type OrderStatus,
  type Page,
} from "@/lib/types";

const TABS: { value: OrderStatus | ""; label: string }[] = [
  { value: "", label: "Tất cả" },
  { value: "PENDING", label: "Chờ xác nhận" },
  { value: "CONFIRMED", label: "Đã xác nhận" },
  { value: "READY", label: "Chờ đến lấy" },
  { value: "COMPLETED", label: "Hoàn tất" },
  { value: "CANCELLED", label: "Đã hủy" },
];

/** Hành động kế tiếp hợp lệ cho từng trạng thái (khớp state machine backend). */
const NEXT_ACTIONS: Partial<Record<OrderStatus, { status: OrderStatus; label: string }[]>> = {
  PENDING: [
    { status: "CONFIRMED", label: "Xác nhận" },
    { status: "CANCELLED", label: "Hủy" },
  ],
  CONFIRMED: [
    { status: "READY", label: "Đã soạn xong" },
    { status: "CANCELLED", label: "Hủy" },
  ],
  READY: [
    { status: "COMPLETED", label: "Đã giao & thu tiền" },
    { status: "CANCELLED", label: "Hủy" },
  ],
};

export default function DoctorOrdersPage() {
  const [tab, setTab] = useState<OrderStatus | "">("PENDING");
  const [code, setCode] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ size: "50" });
    if (code.trim()) params.set("code", code.trim());
    else if (tab) params.set("status", tab);
    api<Page<Order>>(`/api/doctor/orders?${params}`)
      .then((page) => {
        setOrders(page.content);
        setError("");
      })
      .catch(() => setError("Không tải được đơn hàng"))
      .finally(() => setLoading(false));
  }, [tab, code]);

  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [load]);

  async function transition(order: Order, status: OrderStatus) {
    if (status === "CANCELLED" && !confirm(`Hủy đơn ${order.pickupCode}?`)) return;
    try {
      await api(`/api/doctor/orders/${order.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Cập nhật thất bại");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <h1 className="text-xl font-bold">Đơn hàng</h1>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Tra mã nhận hàng..."
          className="border rounded-lg px-3 py-2 w-48 text-sm font-mono uppercase"
        />
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => {
              setTab(t.value);
              setCode("");
            }}
            className={`text-sm px-3 py-1.5 rounded-lg border ${
              tab === t.value && !code
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-white hover:bg-gray-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-gray-500 py-8 text-center">Đang tải...</p>}
      {error && <p className="text-red-600 py-8 text-center">{error}</p>}
      {!loading && !error && orders.length === 0 && (
        <p className="text-gray-500 py-8 text-center">Không có đơn nào.</p>
      )}

      <div className="space-y-4">
        {orders.map((o) => (
          <div key={o.id} className="bg-white border rounded-xl p-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-lg tracking-wider">{o.pickupCode}</span>
                <span className={`text-xs px-2 py-1 rounded ${ORDER_STATUS_COLOR[o.status]}`}>
                  {ORDER_STATUS_LABEL[o.status]}
                </span>
              </div>
              <span className="text-sm text-gray-500">
                {new Date(o.createdAt).toLocaleString("vi-VN")}
              </span>
            </div>

            <p className="text-sm text-gray-600 mt-1">
              Người mua: <span className="font-medium">{o.buyerName ?? "(chưa có tên)"}</span>
              {o.buyerPhone && ` — ${o.buyerPhone}`}
            </p>

            <ul className="mt-2 text-sm text-gray-700 space-y-1">
              {o.items.map((i, idx) => (
                <li key={idx} className="flex justify-between">
                  <span>
                    {i.medicineName} × {i.quantity}
                  </span>
                  <span>{formatVnd(i.salePrice * i.quantity)}</span>
                </li>
              ))}
            </ul>

            <div className="flex items-center justify-between mt-3 pt-3 border-t flex-wrap gap-2">
              <span className="font-semibold">
                Tổng: <span className="text-emerald-700">{formatVnd(o.totalAmount)}</span>
              </span>
              <div className="flex gap-2">
                {(NEXT_ACTIONS[o.status] ?? []).map((a) => (
                  <button
                    key={a.status}
                    onClick={() => transition(o, a.status)}
                    className={
                      a.status === "CANCELLED"
                        ? "text-sm border border-red-300 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50"
                        : "text-sm bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700"
                    }
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
