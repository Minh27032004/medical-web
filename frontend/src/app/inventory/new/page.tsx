"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import MedicineForm from "@/components/MedicineForm";

/**
 * Trang THÊM thuốc mới. Dùng chung MedicineForm với trang sửa nên hai luồng không thể lệch.
 *
 * Next.js ưu tiên đoạn tĩnh hơn đoạn động, nên /inventory/new không đụng /inventory/[id].
 */
export default function NewMedicinePage() {
  const router = useRouter();

  function back() {
    router.push("/inventory");
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-4">
        <Link href="/inventory" className="text-sm text-gray-600 hover:underline">
          ← Kho thuốc
        </Link>
        <h1 className="page-title mt-1">Thêm thuốc mới</h1>
      </div>

      <MedicineForm onSaved={back} onCancel={back} />
    </div>
  );
}
