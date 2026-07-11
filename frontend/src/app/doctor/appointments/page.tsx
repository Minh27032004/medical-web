"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import {
  APPT_STATUS_COLOR,
  APPT_STATUS_LABEL,
  type Appointment,
  type AppointmentStatus,
} from "@/lib/types";

const NEXT_ACTIONS: Partial<
  Record<AppointmentStatus, { status: AppointmentStatus; label: string }[]>
> = {
  BOOKED: [
    { status: "CONFIRMED", label: "Xác nhận" },
    { status: "CANCELLED", label: "Hủy" },
  ],
  CONFIRMED: [
    { status: "DONE", label: "Đã khám xong" },
    { status: "CANCELLED", label: "Hủy" },
  ],
};

function toDateStr(d: Date) {
  return d.toLocaleDateString("sv-SE");
}

export default function DoctorAppointmentsPage() {
  const [date, setDate] = useState(toDateStr(new Date()));
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    api<Appointment[]>(`/api/doctor/appointments?date=${date}`)
      .then((a) => {
        setAppts(a);
        setError("");
      })
      .catch(() => setError("Không tải được lịch hẹn"))
      .finally(() => setLoading(false));
  }, [date]);

  useEffect(load, [load]);

  async function transition(a: Appointment, status: AppointmentStatus) {
    if (status === "CANCELLED" && !confirm("Hủy lịch hẹn này?")) return;
    try {
      await api(`/api/doctor/appointments/${a.id}/status`, {
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
        <h1 className="text-xl font-bold">Lịch hẹn khám</h1>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
        />
      </div>

      {loading && <p className="text-gray-500 py-8 text-center">Đang tải...</p>}
      {error && <p className="text-red-600 py-8 text-center">{error}</p>}
      {!loading && !error && appts.length === 0 && (
        <p className="text-gray-500 py-8 text-center">Không có lịch hẹn ngày này.</p>
      )}

      <div className="space-y-4">
        {appts.map((a) => (
          <div key={a.id} className="bg-white border rounded-xl p-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <span className="font-bold text-lg">
                  {new Date(a.slotStart).toLocaleTimeString("vi-VN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className={`text-xs px-2 py-1 rounded ${APPT_STATUS_COLOR[a.status]}`}>
                  {APPT_STATUS_LABEL[a.status]}
                </span>
              </div>
              <div className="flex gap-2">
                {(NEXT_ACTIONS[a.status] ?? []).map((act) => (
                  <button
                    key={act.status}
                    onClick={() => transition(a, act.status)}
                    className={
                      act.status === "CANCELLED"
                        ? "text-sm border border-red-300 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50"
                        : "text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700"
                    }
                  >
                    {act.label}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-sm text-gray-700 mt-2">
              Bệnh nhân: <span className="font-medium">{a.patientName ?? "(chưa có tên)"}</span>
              {a.patientPhone && ` — ${a.patientPhone}`}
            </p>
            {a.note && <p className="text-sm text-gray-600 mt-1">Ghi chú: {a.note}</p>}

            {(a.status === "CONFIRMED" || a.status === "BOOKED") && (
              <a
                href={`/doctor/patients/new?profileId=${a.profileId ?? ""}`}
                className="inline-block text-sm text-blue-700 hover:underline mt-1"
              >
                → Tạo hồ sơ bệnh nhân từ lịch hẹn này
              </a>
            )}

            {a.documents.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-medium mb-2">Giấy khám sức khỏe đã gửi:</p>
                <div className="flex gap-2 flex-wrap">
                  {a.documents.map((d) => (
                    <a key={d.id} href={d.url} target="_blank" rel="noreferrer">
                      {/* Signed URL có hạn 1h — dùng <img> thay next/image vì URL kèm token động */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={d.url}
                        alt="Giấy khám sức khỏe"
                        className="w-24 h-24 object-cover rounded-lg border hover:opacity-80"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
