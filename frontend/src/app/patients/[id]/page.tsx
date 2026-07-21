"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useMemo, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import PatientForm from "@/components/PatientForm";
import { Badge, IconAlert, IconPlus, IconSyringe, Loading } from "@/components/ui";
import { useApiData } from "@/hooks/useApiData";
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
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletingVisit, setDeletingVisit] = useState<VisitRow | null>(null);
  const [restoreStock, setRestoreStock] = useState(false);
  const router = useRouter();

  // Hai nguồn riêng để mỗi cái tự cache: quay lại hồ sơ vừa xem là hiện ngay.
  const { data: patient, failed: patientFailed, reload: reloadPatient } =
    useApiData<Patient>(`/api/doctor/patients/${id}`);
  const { data: visits = [], reload: reloadVisits } =
    useApiData<VisitRow[]>(`/api/doctor/patients/${id}/visits`);

  /** Xóa mềm hồ sơ — lịch sử khám giữ nguyên, chỉ ẩn bệnh nhân khỏi danh sách. */
  async function removePatient() {
    await api(`/api/doctor/patients/${id}`, { method: "DELETE" });
    router.push("/patients");
  }

  /**
   * Xóa mềm MỘT lần khám ngay trên hồ sơ (cùng đường với trang Lịch sử khám).
   *
   * NHẬN lần khám qua tham số, KHÔNG đọc `deletingVisit!.id` trong closure: React Compiler
   * nâng thuộc tính được truy cập trong closure lên làm khóa memo và đọc nó ở MỖI lần
   * render — lúc chưa bấm xóa thì biến là null nên nổ "Cannot read properties of null".
   */
  async function removeVisit(v: VisitRow) {
    await api(`/api/doctor/visits/${v.id}?restoreStock=${restoreStock}`, { method: "DELETE" });
    reloadVisits();
  }

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

  if (patientFailed) {
    return (
      <p className="text-red-600 py-8 text-center">Không tải được hồ sơ bệnh nhân</p>
    );
  }
  if (!patient) return <Loading />;

  if (editing) {
    return (
      <div className="max-w-lg mx-auto">
        <h1 className="page-title mb-4">Sửa hồ sơ: {patient.fullName}</h1>
        <PatientForm
          initial={patient}
          // api(PUT) đã xóa cache, reload lấy bản mới — không tự setState để tránh
          // lệch giữa dữ liệu hiển thị và dữ liệu trong cache.
          onSaved={() => { setEditing(false); reloadPatient(); }}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div>
      {/* Thẻ hồ sơ: hàng trên là tên + nút, hàng dưới là các trường thông tin nằm ngang
          → thấp hơn hẳn thẻ cũ (nút xếp dọc làm thẻ cao mà bỏ trống bên trái). */}
      <div className="card p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <h1 className="page-title">{patient.fullName}</h1>
          <div className="flex items-center gap-2 shrink-0">
            <Link href={`/patients/${patient.id}/new-visit`} className="btn-primary">
              <IconPlus />
              Tạo lần khám
            </Link>
            <button onClick={() => setEditing(true)} className="btn-ghost">
              Sửa hồ sơ
            </button>
            <button
              onClick={() => setDeleting(true)}
              className="text-sm font-medium text-red-600 hover:underline px-2"
            >
              Xóa
            </button>
          </div>
        </div>

        {/* Các trường thông tin: nhãn nhỏ trên, giá trị dưới — quét mắt theo hàng ngang */}
        <dl className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 text-sm">
          <Field label="Họ và tên" value={patient.fullName} />
          <Field label="Tuổi" value={patient.age != null ? `${patient.age}` : null} />
          <Field label="Giới tính" value={patient.gender ? GENDER_LABEL[patient.gender] : null} />
          <Field label="Số điện thoại" value={patient.phone} />
        </dl>

        {(patient.hasDrugAllergy || patient.hasChronicCondition) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
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
        )}
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

      <ConfirmDialog
        open={!!deletingVisit}
        title="Xóa lần khám này?"
        message={
          <>
            {deletingVisit && new Date(deletingVisit.visitDate).toLocaleDateString("vi-VN")} —{" "}
            {deletingVisit?.diagnosisCode} {deletingVisit?.diagnosisName}.
            Lần khám sẽ bị ẩn khỏi lịch sử; đơn thuốc đã in vẫn được lưu trong hệ thống.
          </>
        }
        onConfirm={() => removeVisit(deletingVisit!)}
        onClose={() => setDeletingVisit(null)}
      >
        <label className="flex items-start gap-2 text-sm bg-gray-50 border rounded-lg p-3 cursor-pointer">
          <input
            type="checkbox"
            checked={restoreStock}
            onChange={(e) => setRestoreStock(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium">Hoàn thuốc về kho</span>
            <span className="block text-xs text-gray-500 mt-0.5">
              Tick nếu xóa vì nhập nhầm và thuốc CHƯA phát cho bệnh nhân. Nếu đã phát thuốc rồi
              thì để trống để tồn kho giữ nguyên.
            </span>
          </span>
        </label>
      </ConfirmDialog>

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
                        {/* Nút Xóa nằm NGOÀI thẻ Link: <button> lồng trong <a> là HTML
                            không hợp lệ, trình duyệt tự gỡ ra và gây lệch hydration. */}
                        {rows.map((v) => (
                          <div key={v.id} className="flex items-baseline gap-2">
                            <Link
                              href={`/visits/${v.id}`}
                              className="flex items-baseline gap-2 flex-1 min-w-0 hover:text-blue-700 group"
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
                            <button
                              onClick={() => { setDeletingVisit(v); setRestoreStock(false); }}
                              className="text-xs font-medium text-red-600 hover:underline shrink-0"
                            >
                              Xóa
                            </button>
                          </div>
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

/** Một trường thông tin trong thẻ hồ sơ. Chưa có dữ liệu thì hiện "—" cho thẳng hàng. */
function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className={`mt-0.5 font-medium ${value ? "text-ink" : "text-gray-400"}`}>
        {value || "—"}
      </dd>
    </div>
  );
}
