"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { cacheGet, cacheHas, cacheSet } from "@/lib/apiCache";

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
export function useApiData<T>(key: string) {
  const [data, setData] = useState<T | undefined>(() => cacheGet<T>(key));
  // Chỉ hiện skeleton khi CHƯA có gì để hiện; có bản cũ thì render luôn, khỏi nháy.
  const [loading, setLoading] = useState(() => !cacheHas(key));
  const [failed, setFailed] = useState(false);
  // Bỏ qua phản hồi về muộn của key cũ (đổi từ khóa tìm kiếm nhanh tay).
  const latestKey = useRef(key);

  const fetchNow = useCallback(async (showSkeleton: boolean) => {
    latestKey.current = key;
    if (showSkeleton) setLoading(true);
    try {
      const fresh = await api<T>(key);
      if (latestKey.current !== key) return;
      cacheSet(key, fresh);
      setData(fresh);
      setFailed(false);
    } catch {
      if (latestKey.current !== key) return;
      // Có bản cũ thì cứ để bác sĩ đọc tiếp, đừng đập đi thay bằng màn hình lỗi.
      if (!cacheHas(key)) setFailed(true);
    } finally {
      if (latestKey.current === key) setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    const cached = cacheGet<T>(key);
    setData(cached);
    setFailed(false);
    fetchNow(cached === undefined);
  }, [key, fetchNow]);

  /**
   * Tải lại có chủ đích (sau khi lưu/xóa, hoặc bấm "Thử lại").
   * Chỉ hiện skeleton khi màn hình đang TRỐNG. Sau mỗi lần lưu, api() đã xóa sạch cache
   * nên nếu căn theo cache thì lần nào cũng nháy skeleton — trong khi bảng vẫn đang có
   * dữ liệu cũ hoàn toàn đọc được, chỉ chờ số mới thay vào.
   */
  const reload = useCallback(() => fetchNow(data === undefined), [fetchNow, data]);

  return { data, loading, failed, reload };
}
