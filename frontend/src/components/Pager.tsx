/** Phân trang đơn giản: ← Trước / Trang x/y / Sau →. Ẩn khi chỉ 1 trang. */
export default function Pager({
  page, totalPages, onPage,
}: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 mt-4 text-sm">
      <button
        onClick={() => onPage(Math.max(0, page - 1))}
        disabled={page === 0}
        className="border px-3 py-1.5 rounded-lg disabled:opacity-40 hover:bg-gray-50"
      >
        ← Trước
      </button>
      <span className="text-gray-600">Trang {page + 1}/{totalPages}</span>
      <button
        onClick={() => onPage(Math.min(totalPages - 1, page + 1))}
        disabled={page >= totalPages - 1}
        className="border px-3 py-1.5 rounded-lg disabled:opacity-40 hover:bg-gray-50"
      >
        Sau →
      </button>
    </div>
  );
}
