import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client phía browser — CHỈ dùng cho Auth (đăng ký, đăng nhập, lấy token).
 * Mọi dữ liệu nghiệp vụ đi qua Spring Boot API (xem docs/ARCHITECTURE.md).
 * Dùng @supabase/ssr để session lưu trong cookie → middleware.ts đọc được.
 */
export function createSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
