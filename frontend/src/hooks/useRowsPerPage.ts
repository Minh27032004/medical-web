"use client";

import { useEffect, useState } from "react";

/**
 * Chiều cao phần khung CỐ ĐỊNH của AppShell, phải khớp với AppShell.tsx:
 * top bar desktop h-[72px] / mobile h-14, và padding dọc của <main> py-6 md:py-8.
 */
const TOP_BAR_DESKTOP = 72;
const TOP_BAR_MOBILE = 56;
const PAGE_PADDING_DESKTOP = 64; // py-8 × 2
const PAGE_PADDING_MOBILE = 48; // py-6 × 2
const MD_BREAKPOINT = 768;

/**
 * Số dòng vừa ĐÚNG một màn — đo từ chiều cao cửa sổ THẬT lúc chạy.
 *
 * Vì sao đo chứ không đặt hằng số: chiều cao khả dụng phụ thuộc những thứ chỉ máy người
 * dùng mới biết — mức phóng của Windows (máy chủ dự án đang để 150%, nên màn 1920×1080
 * chỉ còn 1280×720 CSS px), chiều cao thanh địa chỉ, có bật thanh dấu trang hay không,
 * cửa sổ có full màn hay không. Mọi con số cố định đều đúng trên đúng một máy.
 *
 * Trả về 0 khi CHƯA đo được (render đầu / SSR). Trang phải dùng số 0 đó để tạo khóa RỖNG
 * cho useApiData — hook bỏ qua khóa rỗng nên không có lượt gọi API thừa với size sai,
 * chỉ đúng một lượt tải sau khi đã đo.
 *
 * @param reserved  Tổng chiều cao mọi thứ KHÔNG PHẢI dòng dữ liệu trong vùng nội dung:
 *                  hàng tiêu đề trang, hàng bộ lọc, tiêu đề bảng, viền thẻ, phân trang.
 * @param rowHeight Chiều cao MỘT dòng, gồm cả padding dọc của ô.
 */
export function useRowsPerPage({
  reserved,
  rowHeight,
  min = 3,
  max = 50,
}: {
  reserved: number;
  rowHeight: number;
  min?: number;
  max?: number;
}): number {
  const [rows, setRows] = useState(0);

  useEffect(() => {
    function measure() {
      const mobile = window.innerWidth < MD_BREAKPOINT;
      const chrome = mobile ? TOP_BAR_MOBILE : TOP_BAR_DESKTOP;
      const padding = mobile ? PAGE_PADDING_MOBILE : PAGE_PADDING_DESKTOP;
      const available = window.innerHeight - chrome - padding - reserved;
      setRows(Math.min(max, Math.max(min, Math.floor(available / rowHeight))));
    }

    measure();

    // Đổi cỡ cửa sổ → tính lại. Trễ 150ms vì kéo cạnh cửa sổ bắn ra hàng chục sự kiện,
    // mà mỗi lần đổi số dòng là một lượt gọi API mới (size nằm trong khóa cache).
    let timer: ReturnType<typeof setTimeout>;
    function onResize() {
      clearTimeout(timer);
      timer = setTimeout(measure, 150);
    }
    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", onResize);
    };
  }, [reserved, rowHeight, min, max]);

  return rows;
}

/**
 * Chiều cao chuẩn dùng chung để tính `reserved` — đổi ở đây là mọi trang danh sách đổi theo.
 * Con số lấy từ globals.css và các component thật, KHÔNG phải ước lượng:
 */
export const H = {
  /** Hàng tiêu đề trang: cao bằng ô nhập/nút (.input py-2.5 = 40px + viền 2). */
  titleRow: 42,
  /** Hàng chip lọc (.chip py-1.5 = 30px + viền 2). */
  chipRow: 32,
  /** Tiêu đề bảng (.data-table thead th py-2.5 + chữ 12px/16px). */
  tableHead: 36,
  /** Viền trên + dưới của .card. */
  cardBorder: 2,
  /** Phân trang: mt-5 (20) + nút .btn-ghost py-2.5 (40) + viền 2. */
  pager: 62,
  /** Một dòng .data-table: py-2.5 × 2 + nội dung cao nhất (badge 22px). */
  tableRow: 42,
} as const;
