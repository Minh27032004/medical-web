"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Page, Patient } from "@/lib/types";

export default function DoctorPatientsPage() {
  const [q, setQ] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api<Page<Patient>>(`/api/doctor/patients?q=${encodeURIComponent(q)}&size=50`)
      .then((page) => {
        setPatients(page.content);
        setError("");
      })
      .catch(() => setError("Không tải được danh sách bệnh nhân"))
      .finally(() => setLoading(false));
  }, [q]);

  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <h1 className="text-xl font-bold">Bệnh nhân</h1>
        <div className="flex gap-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm theo tên hoặc SĐT..."
            className="border rounded-lg px-3 py-2 w-56 text-sm"
          />
          <Link
            href="/doctor/patients/new"
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700"
          >
            + Bệnh nhân mới
          </Link>
        </div>
      </div>

      {loading && <p className="text-gray-500 py-8 text-center">Đang tải...</p>}
      {error && <p className="text-red-600 py-8 text-center">{error}</p>}
      {!loading && !error && patients.length === 0 && (
        <p className="text-gray-500 py-8 text-center">Chưa có bệnh nhân nào.</p>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        {patients.map((p) => (
          <Link
            key={p.id}
            href={`/doctor/patients/${p.id}`}
            className="bg-white border rounded-xl p-4 flex items-center gap-3 hover:border-emerald-400"
          >
            <div className="w-12 h-12 bg-gray-100 rounded-full overflow-hidden shrink-0">
              {p.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.photoUrl} alt={p.fullName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xl">🧑</div>
              )}
            </div>
            <div>
              <p className="font-medium">{p.fullName}</p>
              <p className="text-sm text-gray-600">
                {p.age != null && `${p.age} tuổi`}
                {p.age != null && p.phone && " — "}
                {p.phone}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
