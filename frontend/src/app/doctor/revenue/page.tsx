"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatVnd } from "@/lib/format";
import type { Prescription } from "@/lib/types";

interface Summary {
  from: string;
  to: string;
  examTotal: number;
  prescriptionSale: number;
  prescriptionCost: number;
  orderSale: number;
  orderCost: number;
  grandTotal: number;
  grossProfit: number;
  prescriptionCount: number;
  orderCount: number;
}

type Period = "day" | "week" | "month";

const PERIOD_LABEL: Record<Period, string> = {
  day: "Ngày",
  week: "Tuần",
  month: "Tháng",
};

function toDateStr(d: Date) {
  return d.toLocaleDateString("sv-SE");
}

export default function RevenuePage() {
  const [period, setPeriod] = useState<Period>("day");
  const [date, setDate] = useState(toDateStr(new Date()));
  const [summary, setSummary] = useState<Summary | null>(null);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Summary>(`/api/doctor/revenue?period=${period}&date=${date}`)
      .then((s) => {
        setSummary(s);
        setError("");
      })
      .catch(() => setError("Không tải được doanh thu"));
  }, [period, date]);

  // Tab "Ngày": hiện kèm list đơn thuốc trong ngày + giá gốc để đối chiếu trực quan
  useEffect(() => {
    if (period !== "day") return;
    api<Prescription[]>(`/api/doctor/prescriptions?date=${date}`)
      .then(setPrescriptions)
      .catch(() => {});
  }, [period, date]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <h1 className="text-xl font-bold">Doanh thu & lịch sử khám</h1>
        <div className="flex gap-2 items-center">
          {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`text-sm px-3 py-1.5 rounded-lg border ${
                period === p ? "bg-emerald-600 text-white border-emerald-600" : "bg-white hover:bg-gray-50"
              }`}
            >
              {PERIOD_LABEL[p]}
            </button>
          ))}
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm"
          />
        </div>
      </div>

      {error && <p className="text-red-600 py-8 text-center">{error}</p>}

      {summary && (
        <>
          <p className="text-sm text-gray-500 mb-3">
            {new Date(summary.from).toLocaleDateString("vi-VN")} →{" "}
            {new Date(summary.to).toLocaleDateString("vi-VN")}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-white border rounded-xl p-4">
              <p className="text-sm text-gray-500">Tổng thu</p>
              <p className="text-xl font-bold text-emerald-700">{formatVnd(summary.grandTotal)}</p>
            </div>
            <div className="bg-white border rounded-xl p-4">
              <p className="text-sm text-gray-500">Lãi gộp</p>
              <p className="text-xl font-bold text-emerald-700">{formatVnd(summary.grossProfit)}</p>
            </div>
            <div className="bg-white border rounded-xl p-4">
              <p className="text-sm text-gray-500">Tiền công khám</p>
              <p className="text-lg font-semibold">{formatVnd(summary.examTotal)}</p>
              <p className="text-xs text-gray-500">{summary.prescriptionCount} ca khám</p>
            </div>
            <div className="bg-white border rounded-xl p-4">
              <p className="text-sm text-gray-500">Tiền thuốc</p>
              <p className="text-lg font-semibold">
                {formatVnd(summary.prescriptionSale + summary.orderSale)}
              </p>
              <p className="text-xs text-gray-500">
                đơn khám {formatVnd(summary.prescriptionSale)} · online {formatVnd(summary.orderSale)} (
                {summary.orderCount} đơn)
              </p>
            </div>
          </div>
        </>
      )}

      {period === "day" && (
        <div>
          <h2 className="font-bold mb-3">Đơn thuốc trong ngày ({prescriptions.length})</h2>
          {prescriptions.length === 0 && (
            <p className="text-gray-500 text-sm">Chưa có ca khám nào trong ngày.</p>
          )}
          <div className="space-y-3">
            {prescriptions.map((rx) => {
              const total = rx.examFee + rx.medicineTotal;
              const profit = rx.examFee + rx.medicineTotal - (rx.costTotal ?? 0);
              return (
                <div key={rx.id} className="bg-white border rounded-xl p-4 flex gap-4 flex-wrap">
                  <div className="flex-1 min-w-52">
                    <div className="flex justify-between flex-wrap gap-2">
                      <span className="font-medium">{rx.patientName ?? "(không tên)"}</span>
                      <span className="text-sm text-gray-500">
                        {new Date(rx.createdAt).toLocaleTimeString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    {rx.diagnosis && <p className="text-sm text-gray-600">{rx.diagnosis}</p>}
                    <ul className="text-sm text-gray-700 mt-1">
                      {rx.items.map((i, idx) => (
                        <li key={idx}>
                          💊 {i.medicineName} × {i.quantity}{" "}
                          <span className="text-gray-400">
                            (gốc {formatVnd((i.costPrice ?? 0) * i.quantity)} → bán{" "}
                            {formatVnd(i.salePrice * i.quantity)})
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {/* Tổng kết doanh thu từng ca kế bên — trực quan theo yêu cầu */}
                  <div className="text-right shrink-0 border-l pl-4">
                    <p className="text-sm text-gray-500">Khám: {formatVnd(rx.examFee)}</p>
                    <p className="text-sm text-gray-500">Thuốc: {formatVnd(rx.medicineTotal)}</p>
                    <p className="font-bold text-emerald-700 mt-1">{formatVnd(total)}</p>
                    <p className="text-xs text-gray-500">lãi {formatVnd(profit)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
