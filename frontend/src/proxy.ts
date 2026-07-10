import { NextRequest, NextResponse } from "next/server";

/**
 * (Next 16: middleware.ts đã đổi tên thành proxy.ts)
 * Chặn UX cho vùng cần đăng nhập. Đây KHÔNG phải lớp bảo mật —
 * bảo mật thật nằm ở Spring Boot (verify JWT + role). Proxy chỉ
 * kiểm tra cookie session Supabase có tồn tại để redirect sớm về /login.
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));

  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/account/:path*", "/doctor/:path*", "/booking/:path*"],
};
