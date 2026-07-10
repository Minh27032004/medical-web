"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatVnd } from "@/lib/format";
import { IMAGE_KIND_LABEL, type Prescription } from "@/lib/types";

export default function MyPrescriptionsPage() {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Prescription[]>("/api/me/prescriptions")
      .then(setPrescriptions)
      .catch(() => setError("Không tải được đơn thuốc"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-500 py-8 text-center">Đang tải...</p>;
  if (error) return <p className="text-red-600 py-8 text-center">{error}</p>;

  if (prescriptions.length === 0) {
    return (
      <p className="text-gray-500 py-12 text-center">
        Bạn chưa có đơn thuốc nào. Đơn thuốc xuất hiện ở đây sau khi bác sĩ khám
        và liên kết hồ sơ với tài khoản của bạn.
      </p>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Đơn thuốc của tôi</h1>
      <div className="space-y-4">
        {prescriptions.map((rx) => (
          <div key={rx.id} className="bg-white border rounded-xl p-4">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <span className="text-sm text-gray-500">
                Khám ngày {new Date(rx.createdAt).toLocaleDateString("vi-VN")}
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
            <div className="mt-3 border-t pt-2">
              <p className="text-sm font-medium mb-1">Thuốc được kê:</p>
              <ul className="text-sm text-gray-700 space-y-1">
                {rx.items.map((i, idx) => (
                  <li key={idx} className="flex justify-between">
                    <span>
                      💊 {i.medicineName} × {i.quantity}
                      {i.dosage && <span className="text-gray-500"> — {i.dosage}</span>}
                    </span>
                    <span>{formatVnd(i.salePrice * i.quantity)}</span>
                  </li>
                ))}
              </ul>
            </div>
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
