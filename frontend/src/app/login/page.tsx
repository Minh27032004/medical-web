"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api } from "@/lib/api";
import { createSupabaseClient } from "@/lib/supabase";
import type { Me } from "@/lib/types";

/** Username ⇔ email ảo @clinic.local (D15). */
const EMAIL_DOMAIN = "@clinic.local";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createSupabaseClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: username.trim().toLowerCase() + EMAIL_DOMAIN,
      password,
    });
    if (authError) {
      setLoading(false);
      setError("Sai tên đăng nhập hoặc mật khẩu");
      return;
    }
    // Lấy role để điều hướng; backend cũng là nơi chặn tài khoản bị khóa
    try {
      const me = await api<Me>("/api/me/profile");
      const next = searchParams.get("next");
      router.push(next && next !== "/" ? next : me.role === "ADMIN" ? "/admin/doctors" : "/patients");
      router.refresh();
    } catch {
      await supabase.auth.signOut();
      setLoading(false);
      setError("Tài khoản đã bị khóa hoặc không có quyền truy cập");
    }
  }

  return (
    <div className="max-w-sm mx-auto py-16">
      <div className="text-center mb-8">
        <div className="text-5xl mb-2">⚕</div>
        <h1 className="text-2xl font-bold text-blue-900">Quản lý phòng khám</h1>
        <p className="text-sm text-gray-500 mt-1">Hệ thống nội bộ dành cho bác sĩ</p>
      </div>
      <form onSubmit={handleSubmit} className="bg-white border rounded-2xl p-6 space-y-4 shadow-sm">
        <div>
          <label className="block text-sm mb-1 font-medium">Tên đăng nhập</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
            autoComplete="username"
            required
          />
        </div>
        <div>
          <label className="block text-sm mb-1 font-medium">Mật khẩu</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
            autoComplete="current-password"
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
        <p className="text-xs text-gray-400 text-center">
          Chưa có tài khoản? Liên hệ quản trị viên để được cấp.
        </p>
      </form>
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
