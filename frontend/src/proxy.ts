import { NextRequest, NextResponse } from "next/server";

/**
 * Hệ NỘI BỘ (D13): mọi trang đều cần đăng nhập, chỉ /login là public.
 * Đây là chặn UX — bảo mật thật nằm ở Spring Boot (JWT + role + doctor_id).
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
  // chặn tất cả trừ login và tài nguyên tĩnh
  matcher: ["/((?!login|_next|favicon\\.ico|icon\\.png|images).*)"],
};
