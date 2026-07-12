"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import PatientForm from "@/components/PatientForm";
import { api } from "@/lib/api";
import { GENDER_LABEL, type Patient, type VisitRow } from "@/lib/types";

/** Nhãn buổi khám suy từ giờ (§ hiển thị): Sáng < 12h, Chiều 12–18h, Tối ≥ 18h. */
function sessionLabel(iso: string) {
  const h = new Date(iso).getHours();
  if (h < 12) return "Sáng";
  if (h < 18) return "Chiều";
  return "Tối";
}

export default function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    Promise.all([
      api<Patient>(`/api/doctor/patients/${id}`),
      api<VisitRow[]>(`/api/doctor/patients/${id}/visits`),
    ])
      .then(([p, v]) => {
        setPatient(p);
        setVisits(v);
      })
      .catch(() => setError("Không tải được hồ sơ bệnh nhân"));
  }, [id]);

  useEffect(load, [load, editing]);

  // Gom theo NGÀY (visits đã sắp mới→cũ): mỗi ngày một dòng, nhiều buổi chung một ô.
  const byDay = useMemo(() => {
    const map = new Map<string, VisitRow[]>();
    for (const v of visits) {
      const day = new Date(v.visitDate).toLocaleDateString("vi-VN");
      const arr = map.get(day);
      if (arr) arr.push(v);
      else map.set(day, [v]);
    }
    return [...map.entries()];
  }, [visits]);

  if (error) return <p className="text-red-600 py-8 text-center">{error}</p>;
  if (!patient) return <p className="text-gray-500 py-8 text-center">Đang tải...</p>;

  if (editing) {
    return (
      <div className="max-w-lg mx-auto">
        <h1 className="text-xl font-bold mb-4">Sửa hồ sơ: {patient.fullName}</h1>
        <PatientForm initial={patient} />
        <button onClick={() => setEditing(false)} className="text-sm text-gray-600 mt-3 hover:underline">
          ← Quay lại
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white border rounded-xl p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold">{patient.fullName}</h1>
            <p className="text-sm text-gray-600 mt-0.5">
              {patient.gender ? GENDER_LABEL[patient.gender] : ""}
              {patient.gender && patient.phone && " · "}
              {patient.phone}
              {patient.address && ` · ${patient.address}`}
            </p>
            <div className="mt-2 space-y-1 text-sm">
              {patient.hasDrugAllergy && (
                <p className="text-red-700 bg-red-50 rounded px-2 py-1 inline-block">
                  ⚠ Dị ứng thuốc: {patient.drugAllergyNote || "(chưa ghi chú)"}
                </p>
              )}
              {patient.hasChronicCondition && (
                <p className="text-amber-700 bg-amber-50 rounded px-2 py-1 inline-block ml-1">
                  Bệnh nền: {patient.chronicConditionNote || "(chưa ghi chú)"}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <Link
              href={`/patients/${patient.id}/new-visit`}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 text-center"
            >
              + Tạo lần khám
            </Link>
            <button onClick={() => setEditing(true)} className="border px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
              Sửa hồ sơ
            </button>
          </div>
        </div>
      </div>

      <h2 className="font-bold mt-6 mb-3">
        Lịch sử khám <span className="text-gray-400 font-normal">({visits.length} lượt · {byDay.length} ngày)</span>
      </h2>
      {visits.length === 0 && <p className="text-gray-500 text-sm">Chưa có lần khám nào.</p>}

      {visits.length > 0 && (
        <div className="bg-white border rounded-xl overflow-hidden">
          {/* Hiện ~10 ngày gần nhất; cuộn để xem cũ hơn. */}
          <div className="max-h-[30rem] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left sticky top-0 z-10">
                <tr>
                  <th className="p-3 w-32">Ngày</th>
                  <th className="p-3">Lượt khám trong ngày</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {byDay.map(([day, rows]) => (
                  <tr key={day} className="align-top">
                    <td className="p-3 whitespace-nowrap font-medium">
                      {day}
                      <div className="text-xs text-gray-400 font-normal">{rows.length} lượt</div>
                    </td>
                    <td className="p-3">
                      <div className="space-y-1.5">
                        {rows.map((v) => (
                          <Link
                            key={v.id}
                            href={`/visits/${v.id}`}
                            className="flex items-baseline gap-2 hover:text-blue-700 group"
                          >
                            <span className="text-xs text-gray-500 shrink-0 w-24">
                              {sessionLabel(v.visitDate)}{" "}
                              {new Date(v.visitDate).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            <span className="group-hover:underline">
                              {v.diagnosisCode} — {v.diagnosisName}
                            </span>
                            {v.hasInjection && (
                              <span className="text-xs text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded shrink-0">💉</span>
                            )}
                          </Link>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
