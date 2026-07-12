"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { api } from "@/lib/api";
import type { Me } from "@/lib/types";

/** Trang gốc chỉ điều hướng theo vai trò. */
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    api<Me>("/api/me/profile")
      .then((me) => router.replace(me.role === "ADMIN" ? "/admin/doctors" : "/patients"))
      .catch(() => router.replace("/login"));
  }, [router]);

  return <p className="text-gray-500 py-16 text-center">Đang chuyển hướng...</p>;
}
