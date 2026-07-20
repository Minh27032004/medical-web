"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import PatientForm from "@/components/PatientForm";
import { Badge, IconAlert, IconPlus, IconSyringe, Loading } from "@/components/ui";
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
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  /** Xóa mềm hồ sơ — lịch sử khám giữ nguyên, chỉ ẩn bệnh nhân khỏi danh sách. */
  async function removePatient() {
    await api(`/api/doctor/patients/${id}`, { method: "DELETE" });
    router.push("/patients");
  }

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
  if (!patient) return <div className="max-w-3xl mx-auto"><Loading /></div>;

  if (editing) {
    return (
      <div className="max-w-lg mx-auto">
        <h1 className="page-title mb-4">Sửa hồ sơ: {patient.fullName}</h1>
        <PatientForm initial={patient} />
        <button onClick={() => setEditing(false)} className="text-sm text-gray-600 mt-3 hover:underline">
          ← Quay lại
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="page-title">{patient.fullName}</h1>
            <p className="text-sm text-gray-600 mt-0.5">
              {[
                patient.gender ? GENDER_LABEL[patient.gender] : null,
                patient.age != null ? `${patient.age} tuổi` : null,
                patient.phone,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {patient.hasDrugAllergy && (
                <Badge tone="red" icon={<IconAlert size={13} />}>
                  Dị ứng thuốc: {patient.drugAllergyNote || "(chưa ghi chú)"}
                </Badge>
              )}
              {patient.hasChronicCondition && (
                <Badge tone="amber">
                  Bệnh nền: {patient.chronicConditionNote || "(chưa ghi chú)"}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <Link href={`/patients/${patient.id}/new-visit`} className="btn-primary text-center">
              <IconPlus />
              Tạo lần khám
            </Link>
            <button onClick={() => setEditing(true)} className="btn-ghost">
              Sửa hồ sơ
            </button>
            <button onClick={() => setDeleting(true)} className="text-sm font-medium text-red-600 hover:underline">
              Xóa hồ sơ
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={deleting}
        title={`Xóa hồ sơ "${patient.fullName}"?`}
        message={
          visits.length > 0
            ? `Bệnh nhân này đã có ${visits.length} lần khám. Hồ sơ sẽ được ẩn khỏi danh sách nhưng lịch sử khám và các đơn thuốc đã in vẫn được giữ lại trong hệ thống.`
            : "Hồ sơ sẽ được ẩn khỏi danh sách bệnh nhân."
        }
        confirmLabel="Xóa hồ sơ"
        onConfirm={removePatient}
        onClose={() => setDeleting(false)}
      />

      <h2 className="font-bold text-lg text-ink mt-6 mb-3">
        Lịch sử khám <span className="text-gray-400 font-normal text-sm">({visits.length} lượt · {byDay.length} ngày)</span>
      </h2>
      {visits.length === 0 && <p className="text-gray-500 text-sm">Chưa có lần khám nào.</p>}

      {visits.length > 0 && (
        <div className="card overflow-hidden">
          {/* Hiện ~10 ngày gần nhất; cuộn để xem cũ hơn. */}
          <div className="max-h-[30rem] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/70 text-left sticky top-0 z-10 text-xs uppercase tracking-wide text-gray-400">
                <tr>
                  <th className="px-4 py-3 w-32">Ngày</th>
                  <th className="px-4 py-3">Lượt khám trong ngày</th>
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
                              <Badge tone="purple" icon={<IconSyringe size={12} />}>tiêm</Badge>
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
