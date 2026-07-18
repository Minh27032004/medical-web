import { useEffect, useState } from "react";

/**
 * Trả về giá trị "trễ" sau `ms` không đổi — dùng cho ô tìm kiếm.
 * Giá trị ban đầu trả về NGAY (không trễ) → lần tải đầu của trang không phải đợi.
 */
export function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    if (Object.is(debounced, value)) return; // giá trị đầu / không đổi → khỏi hẹn giờ
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- so sánh với debounced hiện tại là chủ đích
  }, [value, ms]);
  return debounced;
}
