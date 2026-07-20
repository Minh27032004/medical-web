"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

/**
 * Cache dữ liệu GET dùng chung cả phiên, theo kiểu stale-while-revalidate:
 * có dữ liệu cũ thì HIỆN NGAY rồi mới lặng lẽ tải bản mới ở nền.
 *
 * Vì sao cần: app điều hướng kiểu SPA nên rời trang là component chết, quay lại là fetch
 * từ đầu. Bệnh nhân → mở hồ sơ → bấm Back = tải lại toàn bộ danh sách, mỗi lần vài trăm ms
 * nhìn skeleton, dù dữ liệu vừa xem xong 2 giây trước.
 *
 * Cache nằm trong RAM tab, không đụng localStorage — dữ liệu bệnh nhân không nên nằm lại
 * trên máy sau khi đóng tab. Đóng tab hoặc F5 là sạch.
 */
const cache = new Map<string, unknown>();

/** Xóa cache theo tiền tố đường dẫn — gọi sau khi ghi dữ liệu để lần đọc sau lấy bản mới. */
export function invalidate(prefix: string) {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

export function useApiData<T>(key: string) {
  const [data, setData] = useState<T | undefined>(() => cache.get(key) as T | undefined);
  // Chỉ hiện skeleton khi CHƯA có gì để hiện; có bản cũ thì render luôn, khỏi nháy.
  const [loading, setLoading] = useState(() => !cache.has(key));
  const [failed, setFailed] = useState(false);
  // Bỏ qua phản hồi về muộn của key cũ (đổi từ khóa tìm kiếm nhanh tay).
  const latestKey = useRef(key);

  const fetchNow = useCallback(async (showSkeleton: boolean) => {
    latestKey.current = key;
    if (showSkeleton) setLoading(true);
    try {
      const fresh = await api<T>(key);
      if (latestKey.current !== key) return;
      cache.set(key, fresh);
      setData(fresh);
      setFailed(false);
    } catch {
      if (latestKey.current !== key) return;
      // Có bản cũ thì cứ để bác sĩ đọc tiếp, đừng đập đi thay bằng màn hình lỗi.
      if (!cache.has(key)) setFailed(true);
    } finally {
      if (latestKey.current === key) setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    const cached = cache.get(key) as T | undefined;
    setData(cached);
    setFailed(false);
    fetchNow(cached === undefined);
  }, [key, fetchNow]);

  /** Tải lại có chủ đích (sau khi lưu/xóa, hoặc bấm "Thử lại"). */
  const reload = useCallback(() => fetchNow(!cache.has(key)), [fetchNow, key]);

  return { data, loading, failed, reload };
}
