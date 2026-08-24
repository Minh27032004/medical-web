"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { cacheGet, cacheHas, cacheSet, dedupeInflight } from "@/lib/apiCache";

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

  /**
   * Đánh số từng LƯỢT tải; chỉ lượt mới nhất được quyền ghi kết quả.
   *
   * Vì sao đếm lượt chứ không so key: so key chỉ chặn được phản hồi về muộn của key CŨ
   * (đổi từ khóa tìm kiếm nhanh tay), không chặn được hai lượt CÙNG key chồng nhau —
   * cả hai đều thấy key khớp nên đều ghi. Mạng chậm mà bấm lưu/thử lại hai nhịp là đủ:
   * lượt sau về trước hiện số mới, lượt trước về sau đè lại số CŨ, và đè cả vào cache
   * nên rời trang quay lại vẫn sai. Với sổ sách thuốc thì đó là kiểu sai nguy hiểm nhất.
   */
  const seq = useRef(0);

  const fetchNow = useCallback(async (showSkeleton: boolean) => {
    /**
     * Khóa RỖNG = "chưa cần gọi" — dùng cho ô tìm kiếm khi người dùng chưa gõ gì.
     * Không có nhánh này thì key "" vẫn đi thành một request tới base URL của API:
     * mỗi lần mở trang là một lượt gọi thừa, rồi trả 404 và bật cờ failed.
     * Vẫn tăng seq để lượt đang bay của khóa TRƯỚC không kịp ghi đè kết quả.
     */
    if (!key) {
      seq.current++;
      setLoading(false);
      setFailed(false);
      return;
    }
    const mine = ++seq.current;
    if (showSkeleton) setLoading(true);
    try {
      // Gộp với lượt cùng key đang bay (vd nhiều ô autocomplete trên một form).
      const fresh = await dedupeInflight(key, () => api<T>(key));
      if (mine !== seq.current) return; // đã có lượt mới hơn → kết quả này lỗi thời, vứt
      cacheSet(key, fresh);
      setData(fresh);
      setFailed(false);
    } catch {
      if (mine !== seq.current) return;
      // Có bản cũ thì cứ để bác sĩ đọc tiếp, đừng đập đi thay bằng màn hình lỗi.
      if (!cacheHas(key)) setFailed(true);
    } finally {
      if (mine === seq.current) setLoading(false);
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
