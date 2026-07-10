"use client";

import { use, useEffect, useState } from "react";
import MedicineForm from "@/components/MedicineForm";
import { api } from "@/lib/api";
import type { MedicineDoctor, Page } from "@/lib/types";

export default function EditMedicinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [medicine, setMedicine] = useState<MedicineDoctor | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    // Chưa có GET /api/doctor/medicines/{id} riêng — lấy từ list (kho nhỏ, chấp nhận được)
    api<Page<MedicineDoctor>>(`/api/doctor/medicines?size=100`)
      .then((page) => {
        const found = page.content.find((m) => m.id === id);
        if (found) setMedicine(found);
        else setError("Không tìm thấy thuốc");
      })
      .catch(() => setError("Không tải được dữ liệu"));
  }, [id]);

  if (error) return <p className="text-red-600 py-8 text-center">{error}</p>;
  if (!medicine) return <p className="text-gray-500 py-8 text-center">Đang tải...</p>;

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Sửa thuốc: {medicine.name}</h1>
      <MedicineForm initial={medicine} />
    </div>
  );
}
