"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, apiForm, ApiError } from "@/lib/api";
import type { Appointment, Slot } from "@/lib/types";

function toDateStr(d: Date) {
  return d.toLocaleDateString("sv-SE"); // YYYY-MM-DD theo giờ máy
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

export default function BookingPage() {
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  const [date, setDate] = useState(toDateStr(days[0]));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState<Appointment | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);

  useEffect(() => {
    setLoading(true);
    setSelected(null);
    api<Slot[]>(`/api/public/appointments/slots?date=${date}`)
      .then(setSlots)
      .catch(() => setError("Không tải được khung giờ"))
      .finally(() => setLoading(false));
  }, [date]);

  async function book() {
    if (!selected) return;
    setBooking(true);
    setError("");
    try {
      const appt = await api<Appointment>("/api/me/appointments", {
        method: "POST",
        body: JSON.stringify({ slotStart: selected, note: note || null }),
      });
      setBooked(appt);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Đặt lịch thất bại");
    } finally {
      setBooking(false);
    }
  }

  async function uploadDoc(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !booked) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await apiForm(`/api/me/appointments/${booked.id}/documents`, formData);
      setUploadedCount((c) => c + 1);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Upload thất bại");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  if (booked) {
    return (
      <div className="max-w-md mx-auto text-center py-12 space-y-4">
        <div className="text-5xl">📅</div>
        <h1 className="text-xl font-bold">Đặt lịch thành công!</h1>
        <p className="text-gray-700">
          {new Date(booked.slotStart).toLocaleString("vi-VN", {
            weekday: "long",
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
        <div className="bg-white border rounded-xl p-4 text-left space-y-2">
          <p className="text-sm font-medium">
            Gửi trước ảnh giấy khám sức khỏe (nếu có) để bác sĩ xem trước:
          </p>
          <label className="inline-block text-sm border rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-50">
            {uploading ? "Đang tải lên..." : "📎 Chọn ảnh"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={uploadDoc}
              className="hidden"
              disabled={uploading}
            />
          </label>
          {uploadedCount > 0 && (
            <p className="text-sm text-blue-700">✓ Đã gửi {uploadedCount} ảnh</p>
          )}
        </div>
        <Link href="/account/appointments" className="inline-block text-blue-700 hover:underline">
          Xem lịch hẹn của tôi →
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Đặt lịch khám</h1>

      <p className="text-sm font-medium mb-2">Chọn ngày</p>
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {days.map((d) => {
          const v = toDateStr(d);
          return (
            <button
              key={v}
              onClick={() => setDate(v)}
              className={`shrink-0 border rounded-lg px-3 py-2 text-sm ${
                date === v ? "bg-blue-600 text-white border-blue-600" : "bg-white hover:bg-gray-50"
              }`}
            >
              {d.toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" })}
            </button>
          );
        })}
      </div>

      <p className="text-sm font-medium mb-2">Chọn giờ</p>
      {loading ? (
        <p className="text-gray-500 py-4">Đang tải...</p>
      ) : slots.length === 0 ? (
        <p className="text-gray-500 py-4">Phòng khám không làm việc ngày này.</p>
      ) : (
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mb-4">
          {slots.map((s) => (
            <button
              key={s.start}
              disabled={!s.available}
              onClick={() => setSelected(s.start)}
              className={`border rounded-lg py-2 text-sm ${
                selected === s.start
                  ? "bg-blue-600 text-white border-blue-600"
                  : s.available
                    ? "bg-white hover:bg-blue-50"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed line-through"
              }`}
            >
              {timeLabel(s.start)}
            </button>
          ))}
        </div>
      )}

      <p className="text-sm font-medium mb-2">Ghi chú cho bác sĩ (tùy chọn)</p>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="Triệu chứng, mong muốn khám..."
        className="w-full border rounded-lg px-3 py-2 text-sm mb-4"
      />

      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      <button
        onClick={book}
        disabled={!selected || booking}
        className="w-full bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {booking ? "Đang đặt..." : "Xác nhận đặt lịch"}
      </button>
    </div>
  );
}
