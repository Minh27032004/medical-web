import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client phía browser — CHỈ dùng cho Auth (đăng ký, đăng nhập, lấy token).
 * Mọi dữ liệu nghiệp vụ đi qua Spring Boot API (xem docs/ARCHITECTURE.md).
 * Dùng @supabase/ssr để session lưu trong cookie → proxy.ts đọc được.
 *
 * Singleton: nhiều instance GoTrueClient cùng chạy sẽ tranh nhau refresh token
 * và spam warning — tạo đúng 1 client cho cả app.
 */
let client: SupabaseClient | null = null;

export function createSupabaseClient(): SupabaseClient {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return client;
}
