"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, apiForm, ApiError } from "@/lib/api";
import { CLINIC } from "@/lib/clinic-info";
import type { Appointment, Slot } from "@/lib/types";

const MAX_DAYS = 7; // khớp MAX_BOOKING_DAYS phía backend

function toDateStr(d: Date) {
  return d.toLocaleDateString("sv-SE"); // YYYY-MM-DD theo giờ máy
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

/** Khung giờ làm việc hiển thị cho từng thứ (0 = Chủ nhật) — khớp lịch phòng khám. */
function windowsHint(weekday: number): string {
  if (weekday === 0) return "Chủ nhật: 6:00 – 19:30 (làm cả ngày)";
  return "Sáng 6:00 – 7:30 · Chiều 16:30 – 19:30";
}

export default function BookingPage() {
  const days = useMemo(
    () =>
      Array.from({ length: MAX_DAYS }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        return d;
      }),
    []
  );

  const [date, setDate] = useState(toDateStr(days[0]));
  const [time, setTime] = useState(""); // "HH:MM" người khám tự nhập
  const [slots, setSlots] = useState<Slot[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState<Appointment | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);

  const selectedDay = useMemo(() => new Date(date + "T00:00:00"), [date]);

  // Gợi ý các mốc giờ còn trống (bấm là điền vào ô giờ)
  useEffect(() => {
    setError("");
    api<Slot[]>(`/api/public/appointments/slots?date=${date}`)
      .then(setSlots)
      .catch(() => setSlots([]));
  }, [date]);

  function validateLocally(): string | null {
    if (!/^\d{2}:\d{2}$/.test(time)) {
      return "Vui lòng nhập giờ đúng định dạng 24h HH:MM — ví dụ 06:15 hoặc 17:00";
    }
    const chosen = new Date(`${date}T${time}:00`);
    if (isNaN(chosen.getTime())) return "Giờ không hợp lệ";
    if (chosen.getTime() <= Date.now()) {
      return "Giờ khám phải SAU thời điểm hiện tại";
    }
    return null; // giờ làm việc + trùng lịch: backend kiểm tra chính xác
  }

  async function book() {
    const localError = validateLocally();
    if (localError) {
      setError(localError);
      return;
    }
    setBooking(true);
    setError("");
    try {
      const slotStart = new Date(`${date}T${time}:00`).toISOString();
      const appt = await api<Appointment>("/api/me/appointments", {
        method: "POST",
        body: JSON.stringify({ slotStart, note: note || null }),
      });
      setBooked(appt);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Đặt lịch thất bại, thử lại sau");
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
      <h1 className="text-xl font-bold mb-1">Đặt lịch khám</h1>
      <p className="text-sm text-gray-500 mb-4">
        Nhận đặt trước tối đa {MAX_DAYS} ngày. Mỗi lượt khám 30 phút.
      </p>

      <p className="text-sm font-medium mb-2">1️⃣ Chọn ngày</p>
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
        {days.map((d) => {
          const v = toDateStr(d);
          return (
            <button
              key={v}
              onClick={() => {
                setDate(v);
                setTime("");
              }}
              className={`shrink-0 border rounded-lg px-3 py-2 text-sm ${
                date === v ? "bg-blue-600 text-white border-blue-600" : "bg-white hover:bg-gray-50"
              }`}
            >
              {d.toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" })}
            </button>
          );
        })}
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-900 mb-4">
        🕐 Giờ làm việc {selectedDay.getDay() === 0 ? "" : "T2–T7"} —{" "}
        <span className="font-semibold">{windowsHint(selectedDay.getDay())}</span>
        <br />
        <span className="text-blue-700 text-xs">
          Giờ khám phải nằm trong khung trên và sau thời điểm hiện tại.
        </span>
      </div>

      <p className="text-sm font-medium mb-2">2️⃣ Nhập giờ khám (định dạng 24h — HH:MM)</p>
      <div className="flex items-center gap-3 mb-2">
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          step={300}
          className="border rounded-lg px-4 py-2.5 text-lg font-mono w-40"
          required
        />
        <span className="text-xs text-gray-500">Ví dụ: 06:15, 17:00, 18:45</span>
      </div>

      {slots.some((s) => s.available) && (
        <>
          <p className="text-xs text-gray-500 mb-1.5">Hoặc bấm nhanh giờ còn trống:</p>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {slots
              .filter((s) => s.available)
              .map((s) => {
                const label = timeLabel(s.start);
                return (
                  <button
                    key={s.start}
                    onClick={() => setTime(label.padStart(5, "0"))}
                    className={`border rounded-full px-3 py-1 text-xs ${
                      time === label.padStart(5, "0")
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white hover:bg-blue-50"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
          </div>
        </>
      )}

      <p className="text-sm font-medium mb-2">3️⃣ Ghi chú cho bác sĩ (tùy chọn)</p>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="Triệu chứng, mong muốn khám..."
        className="w-full border rounded-lg px-3 py-2 text-sm mb-4"
      />

      {error && (
        <p className="text-red-600 text-sm mb-3 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          ⚠️ {error}
        </p>
      )}
      <button
        onClick={book}
        disabled={!time || booking}
        className="w-full bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {booking ? "Đang đặt..." : "Xác nhận đặt lịch"}
      </button>
    </div>
  );
}
