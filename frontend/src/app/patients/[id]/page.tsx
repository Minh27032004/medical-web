"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import PatientForm from "@/components/PatientForm";
import { api } from "@/lib/api";
import { GENDER_LABEL, type Patient, type VisitRow } from "@/lib/types";

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

      <h2 className="font-bold mt-6 mb-3">Lịch sử khám ({visits.length})</h2>
      {visits.length === 0 && <p className="text-gray-500 text-sm">Chưa có lần khám nào.</p>}
      <div className="space-y-2">
        {visits.map((v) => (
          <Link
            key={v.id}
            href={`/visits/${v.id}`}
            className="block bg-white border rounded-xl px-4 py-3 hover:border-blue-400"
          >
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <span className="font-medium">
                  {v.diagnosisCode} — {v.diagnosisName}
                </span>
                {v.hasInjection && <span className="ml-2 text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded">💉 có tiêm</span>}
              </div>
              <span className="text-sm text-gray-500">
                {new Date(v.visitDate).toLocaleString("vi-VN")}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
