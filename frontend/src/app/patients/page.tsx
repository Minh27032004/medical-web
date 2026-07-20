"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Pager from "@/components/Pager";
import { Badge, EmptyState, IconAlert, IconPlus, Loading } from "@/components/ui";
import { useDebounced } from "@/hooks/useDebounced";
import { api } from "@/lib/api";
import { GENDER_LABEL, type Page, type Patient } from "@/lib/types";

export default function PatientsPage() {
  const [q, setQ] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  // Chỉ trễ khi GÕ tìm kiếm; lần vào trang & bấm phân trang tải NGAY.
  const dq = useDebounced(q, 300);

  const load = useCallback(() => {
    api<Page<Patient>>(`/api/doctor/patients?q=${encodeURIComponent(dq)}&page=${page}&size=10`)
      .then((p) => { setPatients(p.content); setTotalPages(p.totalPages); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dq, page]);

  // Đổi từ khóa → về trang đầu.
  useEffect(() => setPage(0), [dq]);

  useEffect(load, [load]);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <h1 className="page-title">Bệnh nhân</h1>
        <div className="flex gap-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm theo tên hoặc SĐT..."
            className="input w-64"
            autoFocus
          />
          <Link href="/patients/new" className="btn-primary shrink-0">
            <IconPlus />
            Bệnh nhân mới
          </Link>
        </div>
      </div>

      {loading && <Loading />}
      {!loading && patients.length === 0 && (
        <EmptyState
          title={q ? "Không tìm thấy bệnh nhân nào" : "Chưa có bệnh nhân"}
          hint={q ? `Không có ai khớp "${q}" — thử từ khóa khác.` : "Tạo hồ sơ đầu tiên để bắt đầu khám."}
          action={
            !q && (
              <Link href="/patients/new" className="btn-primary">
                <IconPlus />
                Bệnh nhân mới
              </Link>
            )
          }
        />
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
                  <th>Tuổi</th>
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
                    <td className="text-gray-600">{p.age ?? "—"}</td>
                    <td className="space-x-1">
                      {p.hasDrugAllergy && (
                        <Badge tone="red" icon={<IconAlert size={13} />} title={p.drugAllergyNote ?? ""}>
                          Dị ứng thuốc
                        </Badge>
                      )}
                      {p.hasChronicCondition && (
                        <Badge tone="amber" title={p.chronicConditionNote ?? ""}>
                          Bệnh nền
                        </Badge>
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
