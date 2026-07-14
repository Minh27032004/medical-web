"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Pager from "@/components/Pager";
import { api } from "@/lib/api";
import { GENDER_LABEL, type Page, type Patient } from "@/lib/types";

export default function PatientsPage() {
  const [q, setQ] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    api<Page<Patient>>(`/api/doctor/patients?q=${encodeURIComponent(q)}&page=${page}&size=10`)
      .then((p) => { setPatients(p.content); setTotalPages(p.totalPages); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [q, page]);

  // Đổi từ khóa → về trang đầu.
  useEffect(() => setPage(0), [q]);

  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-[#1b2559]">Bệnh nhân</h1>
        <div className="flex gap-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm theo tên hoặc SĐT..."
            className="input w-64"
            autoFocus
          />
          <Link href="/patients/new" className="btn-primary shrink-0">
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

      {patients.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Họ tên</th>
                  <th>SĐT</th>
                  <th>Giới tính</th>
                  <th>Lưu ý</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {patients.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/patients/${p.id}`} className="font-semibold text-blue-800 hover:underline">
                        {p.fullName}
                      </Link>
                    </td>
                    <td className="text-gray-600">{p.phone ?? "—"}</td>
                    <td className="text-gray-600">{p.gender ? GENDER_LABEL[p.gender] : "—"}</td>
                    <td className="space-x-1">
                      {p.hasDrugAllergy && (
                        <span className="text-red-700 bg-red-50 px-2 py-0.5 rounded-md text-xs" title={p.drugAllergyNote ?? ""}>
                          ⚠ Dị ứng thuốc
                        </span>
                      )}
                      {p.hasChronicCondition && (
                        <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md text-xs" title={p.chronicConditionNote ?? ""}>
                          Bệnh nền
                        </span>
                      )}
                    </td>
                    <td className="text-right whitespace-nowrap">
                      <Link href={`/patients/${p.id}/new-visit`} className="font-medium text-blue-700 hover:underline">
                        + Khám
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Pager page={page} totalPages={totalPages} onPage={setPage} />
    </div>
  );
}
