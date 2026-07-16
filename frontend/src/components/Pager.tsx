import { IconChevronLeft, IconChevronRight } from "@/components/ui";

/** Phân trang đơn giản: ← Trước / Trang x/y / Sau →. Ẩn khi chỉ 1 trang. */
export default function Pager({
  page, totalPages, onPage,
}: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 mt-5 text-sm">
      <button
        onClick={() => onPage(Math.max(0, page - 1))}
        disabled={page === 0}
        className="btn-ghost disabled:opacity-40 disabled:pointer-events-none"
      >
        <IconChevronLeft />
        Trước
      </button>
      <span className="text-gray-500 font-medium">Trang {page + 1}/{totalPages}</span>
      <button
        onClick={() => onPage(Math.min(totalPages - 1, page + 1))}
        disabled={page >= totalPages - 1}
        className="btn-ghost disabled:opacity-40 disabled:pointer-events-none"
      >
        Sau
        <IconChevronRight />
      </button>
    </div>
  );
}
