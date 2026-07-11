"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { createSupabaseClient } from "@/lib/supabase";
import { mergeToServer } from "@/lib/cart";

/** Bác sĩ gõ "admin" — map thành email nội bộ vì Supabase Auth yêu cầu email. */
const DOCTOR_ALIAS: Record<string, string> = {
  admin: "admin@clinic.local",
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const email =
      DOCTOR_ALIAS[identifier.trim().toLowerCase()] ?? identifier.trim();
    if (!email.includes("@")) {
      setError("Vui lòng nhập email hợp lệ");
      return;
    }
    setLoading(true);
    const supabase = createSupabaseClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (authError) {
      setLoading(false);
      setError("Sai tài khoản hoặc mật khẩu");
      return;
    }
    try {
      await mergeToServer(); // gộp giỏ hàng localStorage vào DB (D9)
    } catch {
      // merge lỗi không chặn đăng nhập — giỏ local vẫn còn
    }
    router.push(searchParams.get("next") ?? "/");
    router.refresh();
  }

  return (
    <div className="max-w-sm mx-auto py-10">
      <h1 className="text-2xl font-bold mb-6 text-center">Đăng nhập</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm mb-1">Email</label>
          <input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
            placeholder="email@example.com"
            required
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Mật khẩu</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
            required
          />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>
      </form>
      <p className="text-sm text-center mt-4 text-gray-600">
        Chưa có tài khoản?{" "}
        <Link href="/register" className="text-blue-700 hover:underline">
          Đăng ký
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
