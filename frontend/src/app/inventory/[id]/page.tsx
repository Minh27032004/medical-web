"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use } from "react";
import MedicineForm from "@/components/MedicineForm";
import { LoadError, Loading } from "@/components/ui";
import { useApiData } from "@/hooks/useApiData";
import type { Medicine } from "@/lib/types";

/** Trang SỬA thuốc — dùng chung MedicineForm với luồng thêm mới, không có bản sao logic nào. */
export default function EditMedicinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: medicine, loading, failed, reload } = useApiData<Medicine>(
    `/api/doctor/medicines/${id}`
  );

  function back() {
    router.push("/inventory");
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-4">
        <Link href="/inventory" className="text-sm text-gray-600 hover:underline">
          ← Kho thuốc
        </Link>
        <h1 className="page-title mt-1">
          Sửa thuốc{medicine ? `: ${medicine.name}` : ""}
        </h1>
      </div>

      {loading && !medicine && <Loading />}
      {failed && !medicine && <LoadError onRetry={reload} />}
      {medicine && (
        <MedicineForm
          initial={medicine}
          onSaved={back}
          onCancel={back}
        />
      )}
    </div>
  );
}
