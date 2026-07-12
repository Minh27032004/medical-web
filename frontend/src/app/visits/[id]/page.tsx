"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { GENDER_LABEL, type VisitDetail } from "@/lib/types";

/** Chi tiết lần khám + trang in đơn thuốc (CSS @media print — §5.4). */
export default function VisitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [visit, setVisit] = useState<VisitDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<VisitDetail>(`/api/doctor/visits/${id}`)
      .then(setVisit)
      .catch(() => setError("Không tải được lần khám"));
  }, [id]);

  async function printRx() {
    if (visit?.prescriptionId) {
      api(`/api/doctor/prescriptions/${visit.prescriptionId}/printed`, { method: "POST" }).catch(() => {});
    }
    window.print();
  }

  if (error) return <p className="text-red-600 py-8 text-center">{error}</p>;
  if (!visit) return <p className="text-gray-500 py-8 text-center">Đang tải...</p>;

  const doseLabel = (n: number) => (n > 0 ? String(n) : "–");

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4 no-print flex-wrap gap-2">
        <h1 className="text-xl font-bold">Chi tiết lần khám</h1>
        <div className="flex gap-2">
          <Link
            href={`/patients/${visit.patient.id}`}
            className="border px-4 py-2 rounded-lg text-sm hover:bg-gray-50"
          >
            ← Hồ sơ bệnh nhân
          </Link>
          <button
            onClick={printRx}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
          >
            🖨 In đơn thuốc
          </button>
        </div>
      </div>

      {/* ===== Vùng in — cũng là vùng xem ===== */}
      <div className="print-area bg-white border rounded-xl p-6 print:border-0 print:p-0">
        <div className="text-center border-b pb-3 mb-4">
          <h2 className="text-lg font-bold uppercase">{visit.doctor.clinicName || "Phòng khám"}</h2>
          <p className="text-sm">
            Bác sĩ: <strong>{visit.doctor.fullName}</strong>
            {visit.doctor.phone && ` — ĐT: ${visit.doctor.phone}`}
          </p>
        </div>

        <h3 className="text-center text-xl font-bold mb-4">ĐƠN THUỐC</h3>

        <div className="text-sm space-y-1 mb-4">
          <p>
            Họ tên: <strong>{visit.patient.fullName}</strong>
            {visit.patient.gender && ` — ${GENDER_LABEL[visit.patient.gender]}`}
            {visit.patient.phone && ` — ${visit.patient.phone}`}
          </p>
          {visit.patient.address && <p>Địa chỉ: {visit.patient.address}</p>}
          {visit.patient.hasDrugAllergy && (
            <p className="text-red-700">⚠ Dị ứng thuốc: {visit.patient.drugAllergyNote}</p>
          )}
          <p>
            Chẩn đoán: <strong>{visit.diagnosisCode} — {visit.diagnosisName}</strong>
          </p>
          {visit.note && <p>Ghi chú: {visit.note}</p>}
        </div>

        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-y bg-gray-50 print:bg-white">
              <th className="py-2 px-2 text-left">#</th>
              <th className="py-2 px-2 text-left">Thuốc</th>
              <th className="py-2 px-1 text-center">Sáng</th>
              <th className="py-2 px-1 text-center">Trưa</th>
              <th className="py-2 px-1 text-center">Chiều</th>
              <th className="py-2 px-1 text-center">Tối</th>
              <th className="py-2 px-1 text-center">Ngày</th>
              <th className="py-2 px-2 text-right">Tổng</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {visit.items.map((it, idx) => (
              <tr key={idx}>
                <td className="py-2 px-2">{idx + 1}</td>
                <td className="py-2 px-2">
                  <span className="font-medium">
                    {it.injection && "💉 "}
                    {it.medicineName}
                  </span>
                  {(it.usageNote || it.specialDoseText) && (
                    <p className="text-xs text-gray-600 italic">
                      {[it.usageNote, it.specialDoseText].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </td>
                {it.injection ? (
                  <td colSpan={5} className="py-2 px-1 text-center text-xs">tiêm theo chỉ định</td>
                ) : (
                  <>
                    <td className="py-2 px-1 text-center">{doseLabel(it.doseMorning)}</td>
                    <td className="py-2 px-1 text-center">{doseLabel(it.doseNoon)}</td>
                    <td className="py-2 px-1 text-center">{doseLabel(it.doseAfternoon)}</td>
                    <td className="py-2 px-1 text-center">{doseLabel(it.doseEvening)}</td>
                    <td className="py-2 px-1 text-center">{it.numDays ?? "–"}</td>
                  </>
                )}
                <td className="py-2 px-2 text-right whitespace-nowrap">
                  {it.totalQuantityBase > 0 ? `${it.totalQuantityBase} ${it.baseUnitLabel}` : "–"}
                </td>
              </tr>
            ))}
            {visit.items.length === 0 && (
              <tr><td colSpan={8} className="py-4 text-center text-gray-500">Không kê thuốc</td></tr>
            )}
          </tbody>
        </table>

        <div className="flex justify-between mt-6 text-sm">
          <div />
          <div className="text-center">
            <p>
              Ngày {new Date(visit.visitDate).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}
            </p>
            <p className="mt-12 font-medium">{visit.doctor.fullName}</p>
          </div>
        </div>
      </div>

      {visit.printedAt && (
        <p className="text-xs text-gray-400 mt-2 no-print">
          Đã in lần gần nhất: {new Date(visit.printedAt).toLocaleString("vi-VN")}
        </p>
      )}
    </div>
  );
}
