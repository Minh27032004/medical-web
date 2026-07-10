"use client";

import Link from "next/link";
import { Suspense, use, useEffect, useState } from "react";
import PatientForm from "@/components/PatientForm";
import { api } from "@/lib/api";
import { formatVnd } from "@/lib/format";
import { IMAGE_KIND_LABEL, type Patient, type Prescription } from "@/lib/types";

export default function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api<Patient>(`/api/doctor/patients/${id}`),
      api<Prescription[]>(`/api/doctor/patients/${id}/prescriptions`),
    ])
      .then(([p, rx]) => {
        setPatient(p);
        setPrescriptions(rx);
      })
      .catch(() => setError("Không tải được hồ sơ bệnh nhân"));
  }, [id, editing]);

  if (error) return <p className="text-red-600 py-8 text-center">{error}</p>;
  if (!patient) return <p className="text-gray-500 py-8 text-center">Đang tải...</p>;

  if (editing) {
    return (
      <div>
        <h1 className="text-xl font-bold mb-4">Sửa hồ sơ: {patient.fullName}</h1>
        <Suspense>
          <PatientForm initial={patient} />
        </Suspense>
        <button onClick={() => setEditing(false)} className="text-sm text-gray-600 mt-3 hover:underline">
          ← Quay lại
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white border rounded-xl p-5 flex items-center gap-4">
        <div className="w-16 h-16 bg-gray-100 rounded-full overflow-hidden shrink-0">
          {patient.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={patient.photoUrl} alt={patient.fullName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl">🧑</div>
          )}
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{patient.fullName}</h1>
          <p className="text-sm text-gray-600">
            {patient.age != null && `${patient.age} tuổi`}
            {patient.age != null && patient.phone && " — "}
            {patient.phone}
            {patient.profileId && " · có tài khoản"}
          </p>
          {patient.note && <p className="text-sm text-gray-600 mt-1">{patient.note}</p>}
        </div>
        <div className="flex flex-col gap-2">
          <Link
            href={`/doctor/prescriptions/new?patientId=${patient.id}`}
            className="text-sm bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 text-center"
          >
            + Tạo đơn thuốc
          </Link>
          <button onClick={() => setEditing(true)} className="text-sm border px-4 py-2 rounded-lg hover:bg-gray-50">
            Sửa hồ sơ
          </button>
        </div>
      </div>

      <h2 className="font-bold mt-6 mb-3">Lịch sử khám ({prescriptions.length})</h2>
      {prescriptions.length === 0 && (
        <p className="text-gray-500 text-sm">Chưa có lần khám nào.</p>
      )}
      <div className="space-y-4">
        {prescriptions.map((rx) => (
          <div key={rx.id} className="bg-white border rounded-xl p-4">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <span className="text-sm text-gray-500">
                {new Date(rx.createdAt).toLocaleString("vi-VN")}
              </span>
              <span className="text-sm font-semibold text-emerald-700">
                {formatVnd(rx.examFee + rx.medicineTotal)}
              </span>
            </div>
            {rx.symptoms && (
              <p className="text-sm mt-2">
                <span className="text-gray-500">Triệu chứng:</span> {rx.symptoms}
              </p>
            )}
            {rx.diagnosis && (
              <p className="text-sm">
                <span className="text-gray-500">Chẩn đoán:</span>{" "}
                <span className="font-medium">{rx.diagnosis}</span>
              </p>
            )}
            <ul className="mt-2 text-sm text-gray-700 space-y-0.5">
              {rx.items.map((i, idx) => (
                <li key={idx}>
                  💊 {i.medicineName} × {i.quantity}
                  {i.dosage && <span className="text-gray-500"> — {i.dosage}</span>}
                </li>
              ))}
            </ul>
            {rx.images.length > 0 && (
              <div className="flex gap-2 mt-3 flex-wrap">
                {rx.images.map((img) => (
                  <a key={img.id} href={img.url} target="_blank" rel="noreferrer" className="text-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt={img.kind} className="w-20 h-20 object-cover rounded-lg border" />
                    <span className="text-xs text-gray-500">{IMAGE_KIND_LABEL[img.kind]}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
