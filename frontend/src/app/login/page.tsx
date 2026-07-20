"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { createSupabaseClient } from "@/lib/supabase";
import type { Me } from "@/lib/types";

/** Tài khoản không có Gmail: username ⇔ email ảo @clinic.local (D15). */
const EMAIL_DOMAIN = "@clinic.local";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true); // đang kiểm tra phiên (quay lại sau Google)

  // Có phiên (đăng nhập sẵn hoặc vừa quay lại từ Google) → xác thực quyền rồi điều hướng.
  useEffect(() => {
    const supabase = createSupabaseClient();
    let done = false;
    const handle = async (session: unknown) => {
      if (done) return;
      if (!session) { setChecking(false); return; }
      done = true;
      try {
        const me = await api<Me>("/api/me/profile");
        const next = searchParams.get("next");
        router.push(next && next !== "/" ? next : me.role === "ADMIN" ? "/admin/doctors" : "/patients");
        router.refresh();
      } catch (err) {
        // CHỈ đăng xuất khi backend thực sự từ chối (401/403). Lỗi mạng hoặc 5xx —
        // hay gặp nhất là Render free tier vừa ngủ dậy — mà đăng xuất kèm câu "chưa có
        // quyền" thì vừa sai vừa làm bác sĩ hoảng, trong khi tài khoản hoàn toàn bình thường.
        const status = err instanceof ApiError ? err.status : 0;
        if (status === 401 || status === 403) {
          await supabase.auth.signOut();
          setError("Bạn chưa có quyền đăng nhập. Vui lòng liên hệ quản trị viên.");
        } else {
          setError("Máy chủ chưa phản hồi. Đợi vài giây rồi bấm Đăng nhập lại.");
        }
        setChecking(false);
        setLoading(false);
        done = false;
      }
    };
    supabase.auth.getSession().then(({ data }) => handle(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => handle(s));
    return () => sub.subscription.unsubscribe();
  }, [router, searchParams]);

  // Đăng nhập username/Gmail + mật khẩu. Thành công → onAuthStateChange ở trên lo điều hướng.
  // Username phải resolve qua backend: tài khoản có Gmail thì email auth = Gmail (V8),
  // ghép <username>@clinic.local máy móc sẽ không khớp auth user nào.
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const id = loginId.trim().toLowerCase();
    let email = id;
    if (!id.includes("@")) {
      try {
        const resolved = await api<{ email: string }>("/api/auth/resolve-login", {
          method: "POST",
          body: JSON.stringify({ loginId: id }),
        });
        email = resolved.email;
      } catch {
        email = id + EMAIL_DOMAIN; // backend không phản hồi → giữ hành vi cũ
      }
    }
    const supabase = createSupabaseClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setLoading(false);
      setError("Sai tên đăng nhập/Gmail hoặc mật khẩu");
    }
  }

  // Đăng nhập Google — quay lại /login (giữ ?next), rồi useEffect trên xác thực quyền.
  async function loginGoogle() {
    setError("");
    const next = searchParams.get("next");
    const redirectTo = `${window.location.origin}/login${next ? `?next=${encodeURIComponent(next)}` : ""}`;
    const supabase = createSupabaseClient();
    await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
  }

  if (checking) {
    return <p className="text-gray-500 py-16 text-center">Đang kiểm tra đăng nhập...</p>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Image
            src="/images/logo.png"
            alt="Phòng khám"
            width={229}
            height={192}
            priority
            className="mx-auto w-auto h-24 object-contain"
          />
          <h1 className="text-xl font-semibold text-gray-900 mt-4">Đăng nhập hệ thống</h1>
          <p className="text-sm text-gray-500 mt-1">Hệ thống nội bộ dành cho bác sĩ</p>
        </div>

        <div className="card shadow-sm p-7 space-y-5">
          <button
            onClick={loginGoogle}
            className="btn-ghost w-full py-2.5"
          >
            <GoogleIcon />
            Đăng nhập bằng Google
          </button>

          <div className="flex items-center gap-3 text-xs text-gray-400">
            <div className="flex-1 border-t border-gray-100" />
            hoặc
            <div className="flex-1 border-t border-gray-100" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm mb-1.5 font-medium text-gray-600">Tên đăng nhập hoặc Gmail</label>
              <input
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                className="input"
                autoComplete="username"
                required
              />
            </div>
            <div>
              <label className="block text-sm mb-1.5 font-medium text-gray-600">Mật khẩu</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                autoComplete="current-password"
                required
              />
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5"
            >
              {loading ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>
          </form>

          <p className="text-xs text-gray-400 text-center">
            Chưa có tài khoản? Liên hệ quản trị viên để được cấp.
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
