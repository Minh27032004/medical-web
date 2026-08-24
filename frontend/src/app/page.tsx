"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getMe } from "@/lib/me";

/** Trang gốc chỉ điều hướng theo vai trò. */
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    getMe()
      .then((me) => router.replace(me.role === "ADMIN" ? "/admin/doctors" : "/dashboard"))
      .catch(() => router.replace("/login"));
  }, [router]);

  return <p className="text-gray-500 py-16 text-center">Đang chuyển hướng...</p>;
}
