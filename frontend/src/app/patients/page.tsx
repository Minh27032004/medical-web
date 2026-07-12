"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { GENDER_LABEL, type Page, type Patient } from "@/lib/types";

export default function PatientsPage() {
  const [q, setQ] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    api<Page<Patient>>(`/api/doctor/patients?q=${encodeURIComponent(q)}&size=50`)
      .then((p) => setPatients(p.content))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [q]);

  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h1 className="text-xl font-bold">Bệnh nhân</h1>
        <div className="flex gap-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm theo tên hoặc SĐT..."
            className="border rounded-lg px-3 py-2 w-64 text-sm"
            autoFocus
          />
          <Link
            href="/patients/new"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 shrink-0"
          >
            + Bệnh nhân mới
          </Link>
        </div>
      </div>

      {loading && <p className="text-gray-500 py-8 text-center">Đang tải...</p>}
      {!loading && patients.length === 0 && (
        <p className="text-gray-500 py-8 text-center">
          {q ? "Không tìm thấy bệnh nhân nào." : "Chưa có bệnh nhân — bấm \"+ Bệnh nhân mới\"."}
        </p>
      )}

      <div className="bg-white border rounded-xl overflow-x-auto">
        {patients.length > 0 && (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="p-3">Họ tên</th>
                <th className="p-3">SĐT</th>
                <th className="p-3">Giới tính</th>
                <th className="p-3">Lưu ý</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {patients.map((p) => (
                <tr key={p.id} className="hover:bg-blue-50/40">
                  <td className="p-3">
                    <Link href={`/patients/${p.id}`} className="font-medium text-blue-800 hover:underline">
                      {p.fullName}
                    </Link>
                  </td>
                  <td className="p-3">{p.phone ?? "—"}</td>
                  <td className="p-3">{p.gender ? GENDER_LABEL[p.gender] : "—"}</td>
                  <td className="p-3 space-x-1">
                    {p.hasDrugAllergy && (
                      <span className="text-red-700 bg-red-50 px-2 py-0.5 rounded text-xs" title={p.drugAllergyNote ?? ""}>
                        ⚠ Dị ứng thuốc
                      </span>
                    )}
                    {p.hasChronicCondition && (
                      <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-xs" title={p.chronicConditionNote ?? ""}>
                        Bệnh nền
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <Link href={`/patients/${p.id}/new-visit`} className="text-blue-700 hover:underline">
                      + Khám
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
