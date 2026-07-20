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
 * Lấy access token. getSession() tự refresh khi token sắp/đã hết hạn, NHƯNG nếu lần
 * refresh đó lỗi mạng thì auth-js cache kết quả hỏng lại 60 giây (REFRESH_FAILURE_COOLDOWN_MS)
 * và trả session = null cho MỌI caller trong khoảng đó → request đi ra không có header
 * Authorization → backend trả 401. Đây chính là lỗi "thỉnh thoảng 401": token vẫn còn
 * refresh_token hợp lệ, chỉ là một cú refresh trượt rồi bị khóa lại một phút.
 *
 * force = true bỏ qua cache đó bằng cách gọi thẳng refreshSession().
 */
async function getToken(force: boolean): Promise<string | null> {
  try {
    const supabase = createSupabaseClient();
    const { data } = force
      ? await supabase.auth.refreshSession()
      : await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    // Mất mạng khi refresh: trả null để request đi tiếp và lỗi mạng nổi lên như lỗi mạng,
    // đừng biến nó thành exception lạ giữa chừng.
    return null;
  }
}

/** Gộp các lần refresh chạy song song thành một — nhiều request 401 cùng lúc chỉ refresh 1 lần. */
let refreshing: Promise<string | null> | null = null;

function refreshOnce(): Promise<string | null> {
  if (!refreshing) {
    refreshing = getToken(true).finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

/** Session chết hẳn — đưa về đăng nhập thay vì để bác sĩ kẹt trên trang trông như đã đăng nhập. */
function toLogin() {
  if (typeof window === "undefined") return;
  if (window.location.pathname.startsWith("/login")) return;
  const next = encodeURIComponent(window.location.pathname);
  window.location.href = `/login?next=${next}`;
}

async function toApiError(res: Response): Promise<ApiError> {
  const body = await res.json().catch(() => null);
  return new ApiError(res.status, body?.code ?? "UNKNOWN", body?.message ?? `Lỗi ${res.status}`);
}

/**
 * Fetch wrapper duy nhất cho toàn app — tự đính JWT của Supabase Auth nếu đã đăng nhập.
 * Không fetch rải rác ngoài file này (quy ước trong .claude/skills/new-feature).
 *
 * Gặp 401 thì refresh token và thử LẠI ĐÚNG MỘT LẦN. An toàn kể cả với POST/PUT: Spring
 * Security chặn ngay ở filter chain, controller chưa hề chạy nên không có ghi dở dang.
 */
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const send = async (token: string | null) => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(`${API_URL}${path}`, { ...options, headers });
  };

  let token = await getToken(false);
  // Không có token nhưng vẫn còn cookie phiên → nhiều khả năng đang dính cooldown refresh.
  if (!token) token = await refreshOnce();

  let res = await send(token);

  if (res.status === 401) {
    const fresh = await refreshOnce();
    if (fresh) res = await send(fresh);
    if (res.status === 401) {
      toLogin();
      throw new ApiError(401, "UNAUTHORIZED", "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.");
    }
  }

  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  return res.json();
}

/** Upload multipart (KHÔNG set Content-Type — browser tự thêm boundary). */
export async function apiForm<T>(path: string, formData: FormData): Promise<T> {
  const send = async (token: string | null) => {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(`${API_URL}${path}`, { method: "POST", headers, body: formData });
  };

  let token = await getToken(false);
  if (!token) token = await refreshOnce();

  let res = await send(token);

  if (res.status === 401) {
    const fresh = await refreshOnce();
    if (fresh) res = await send(fresh);
    if (res.status === 401) {
      toLogin();
      throw new ApiError(401, "UNAUTHORIZED", "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.");
    }
  }

  if (!res.ok) throw await toApiError(res);
  return res.json();
}
