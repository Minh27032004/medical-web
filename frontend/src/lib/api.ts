import { createSupabaseClient } from "./supabase";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
  }
}

/**
 * Fetch wrapper duy nhất cho toàn app — tự đính JWT của Supabase Auth nếu đã đăng nhập.
 * Không fetch rải rác ngoài file này (quy ước trong .claude/skills/new-feature).
 */
export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const supabase = createSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(
      res.status,
      body?.code ?? "UNKNOWN",
      body?.message ?? `Lỗi ${res.status}`
    );
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

/** Upload multipart (KHÔNG set Content-Type — browser tự thêm boundary). */
export async function apiForm<T>(path: string, formData: FormData): Promise<T> {
  const supabase = createSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: Record<string, string> = {};
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers,
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(
      res.status,
      body?.code ?? "UNKNOWN",
      body?.message ?? `Lỗi ${res.status}`
    );
  }
  return res.json();
}
