import { NextRequest, NextResponse } from "next/server";

/**
 * Chặn UX cho vùng cần đăng nhập. Đây KHÔNG phải lớp bảo mật —
 * bảo mật thật nằm ở Spring Boot (verify JWT + role). Middleware chỉ
 * kiểm tra cookie session Supabase có tồn tại để redirect sớm về /login.
 */
export function middleware(request: NextRequest) {
  const hasSession = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token"));

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
