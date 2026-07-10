"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, apiForm, ApiError } from "@/lib/api";
import {
  APPT_STATUS_COLOR,
  APPT_STATUS_LABEL,
  type Appointment,
} from "@/lib/types";

export default function MyAppointmentsPage() {
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api<Appointment[]>("/api/me/appointments")
      .then(setAppts)
      .catch(() => setError("Không tải được lịch hẹn"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  async function cancel(a: Appointment) {
    if (!confirm("Hủy lịch hẹn này?")) return;
    try {
      await api(`/api/me/appointments/${a.id}/cancel`, { method: "POST" });
      load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Hủy thất bại");
    }
  }

  async function uploadDoc(a: Appointment, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append("file", file);
      await apiForm(`/api/me/appointments/${a.id}/documents`, formData);
      load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Upload thất bại");
    } finally {
      e.target.value = "";
    }
  }

  if (loading) return <p className="text-gray-500 py-8 text-center">Đang tải...</p>;
  if (error) return <p className="text-red-600 py-8 text-center">{error}</p>;

  if (appts.length === 0) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-gray-500">Bạn chưa có lịch hẹn nào.</p>
        <Link href="/booking" className="text-emerald-700 hover:underline">
          Đặt lịch khám →
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Lịch hẹn của tôi</h1>
        <Link
          href="/booking"
          className="text-sm bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700"
        >
          + Đặt lịch mới
        </Link>
      </div>
      <div className="space-y-4">
        {appts.map((a) => (
          <div key={a.id} className="bg-white border rounded-xl p-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="font-medium">
                {new Date(a.slotStart).toLocaleString("vi-VN", {
                  weekday: "long",
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <span className={`text-xs px-2 py-1 rounded ${APPT_STATUS_COLOR[a.status]}`}>
                {APPT_STATUS_LABEL[a.status]}
              </span>
            </div>
            {a.note && <p className="text-sm text-gray-600 mt-1">Ghi chú: {a.note}</p>}
            {a.documents.length > 0 && (
              <p className="text-sm text-gray-600 mt-1">📎 Đã gửi {a.documents.length} ảnh giấy khám</p>
            )}
            {(a.status === "BOOKED" || a.status === "CONFIRMED") && (
              <div className="flex gap-3 mt-3 pt-3 border-t text-sm">
                <label className="text-emerald-700 cursor-pointer hover:underline">
                  📎 Gửi ảnh giấy khám
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => uploadDoc(a, e)}
                    className="hidden"
                  />
                </label>
                <button onClick={() => cancel(a)} className="text-red-600 hover:underline">
                  Hủy lịch
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
