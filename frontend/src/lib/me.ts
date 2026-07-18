import { api } from "./api";
import { createSupabaseClient } from "./supabase";
import type { Me } from "./types";

/**
 * Cache profile người dùng cho CẢ app — AppShell, AssistantWidget, trang gốc
 * đều cần /api/me/profile khi mount; gọi qua đây thì cả 3 chia nhau ĐÚNG 1 request.
 * Cache tự xóa khi đăng xuất (SIGNED_OUT) để không lẫn người dùng cũ.
 */
let cache: Promise<Me> | null = null;
let watching = false;

export function getMe(): Promise<Me> {
  if (!watching) {
    watching = true;
    createSupabaseClient().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") cache = null;
    });
  }
  if (!cache) {
    // Lỗi (hết hạn, bị khóa…) thì bỏ cache để lần sau thử lại
    cache = api<Me>("/api/me/profile").catch((e) => {
      cache = null;
      throw e;
    });
  }
  return cache;
}
