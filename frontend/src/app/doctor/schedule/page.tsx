"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { WEEKDAY_LABEL, type AvailabilityRow } from "@/lib/types";

export default function DoctorSchedulePage() {
  const [rows, setRows] = useState<AvailabilityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    api<AvailabilityRow[]>("/api/doctor/schedule")
      .then(setRows)
      .catch(() => setMessage("Không tải được lịch làm việc"))
      .finally(() => setLoading(false));
  }, []);

  function addRow() {
    setRows([...rows, { weekday: 1, startTime: "08:00:00", endTime: "11:30:00", slotMinutes: 30 }]);
  }

  function update(idx: number, patch: Partial<AvailabilityRow>) {
    setRows(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function removeRow(idx: number) {
    setRows(rows.filter((_, i) => i !== idx));
  }

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const saved = await api<AvailabilityRow[]>("/api/doctor/schedule", {
        method: "PUT",
        body: JSON.stringify(rows),
      });
      setRows(saved);
      setMessage("✓ Đã lưu lịch làm việc");
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-gray-500 py-8 text-center">Đang tải...</p>;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-1">Lịch làm việc</h1>
      <p className="text-sm text-gray-600 mb-4">
        Bệnh nhân chỉ đặt được lịch trong các khung giờ này. Mỗi dòng là một khung giờ lặp hằng tuần.
      </p>

      <div className="bg-white border rounded-xl divide-y">
        {rows.length === 0 && (
          <p className="text-gray-500 text-sm p-4">
            Chưa có khung giờ nào — bệnh nhân sẽ không đặt lịch được.
          </p>
        )}
        {rows.map((r, idx) => (
          <div key={idx} className="flex items-center gap-3 p-3 flex-wrap text-sm">
            <select
              value={r.weekday}
              onChange={(e) => update(idx, { weekday: Number(e.target.value) })}
              className="border rounded-lg px-2 py-1.5"
            >
              {WEEKDAY_LABEL.map((label, w) => (
                <option key={w} value={w}>
                  {label}
                </option>
              ))}
            </select>
            <input
              type="time"
              value={r.startTime.slice(0, 5)}
              onChange={(e) => update(idx, { startTime: e.target.value + ":00" })}
              className="border rounded-lg px-2 py-1.5"
            />
            <span>→</span>
            <input
              type="time"
              value={r.endTime.slice(0, 5)}
              onChange={(e) => update(idx, { endTime: e.target.value + ":00" })}
              className="border rounded-lg px-2 py-1.5"
            />
            <select
              value={r.slotMinutes}
              onChange={(e) => update(idx, { slotMinutes: Number(e.target.value) })}
              className="border rounded-lg px-2 py-1.5"
            >
              {[15, 20, 30, 45, 60].map((m) => (
                <option key={m} value={m}>
                  {m} phút/lượt
                </option>
              ))}
            </select>
            <button onClick={() => removeRow(idx)} className="text-red-600 hover:underline ml-auto">
              Xóa
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mt-4">
        <button onClick={addRow} className="text-sm border px-4 py-2 rounded-lg hover:bg-gray-50">
          + Thêm khung giờ
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="text-sm bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? "Đang lưu..." : "Lưu lịch làm việc"}
        </button>
        {message && <span className="text-sm text-gray-700">{message}</span>}
      </div>
    </div>
  );
}
