"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import Pager from "@/components/Pager";
import { Badge, EmptyState, IconSyringe, LoadError, Loading } from "@/components/ui";
import { useApiData } from "@/hooks/useApiData";
import { H, useRowsPerPage } from "@/hooks/useRowsPerPage";
import { api } from "@/lib/api";
import type { Page, VisitRow } from "@/lib/types";

function toDateStr(d: Date) {
  return d.toLocaleDateString("sv-SE"); // yyyy-mm-dd
}

/** Lùi n ngày kể từ hôm nay (n=0 → hôm nay). */
function daysAgo(n: number) {
  return toDateStr(new Date(Date.now() - n * 86400000));
}

const QUICK = [
  ["Hôm nay", 0],
  ["3 ngày", 2],
  ["7 ngày", 6],
  ["30 ngày", 29],
] as const;

export default function HistoryPage() {
  const [from, setFrom] = useState(daysAgo(6));
  const [to, setTo] = useState(daysAgo(0));
  const [page, setPage] = useState(0);
  /**
   * Phân trang Ở SERVER: `page` nằm trong khóa cache nên đổi trang là một lượt tải riêng.
   *
   * Trước đây trang này kéo TRỌN khoảng ngày rồi cắt bằng slice() — bấm chip "30 ngày" ở
   * phòng khám đông là tải về cả nghìn dòng để hiện 10. Đánh đổi: đổi trang giờ tốn một
   * vòng mạng thay vì tức thì, giống hệt trang Bệnh nhân vốn đã phân trang server.
   */
  /**
   * Trừ: hàng tiêu đề + mb-4, hàng chip + mb-4, dòng đếm + mb-2, viền thẻ, tiêu đề bảng,
   * phân trang. Trên 1280×720 ra khoảng 6 lượt khám mỗi trang.
   */
  const pageSize = useRowsPerPage({
    reserved: H.titleRow + 16 + H.chipRow + 16 + 16 + 8 + H.cardBorder + H.tableHead + H.pager,
    rowHeight: H.tableRow,
  });

  const { data, loading, failed, reload: load } = useApiData<Page<VisitRow>>(
    pageSize ? `/api/doctor/visits?from=${from}&to=${to}&page=${page}&size=${pageSize}` : ""
  );
  // useMemo: `?? []` tạo mảng mới mỗi lần render, làm useMemo byDay bên dưới tính lại vô ích
  // (cùng quy ước với trang Kho thuốc).
  const visits = useMemo(() => data?.content ?? [], [data]);
  const totalPages = data?.totalPages ?? 1;
  const total = data?.totalElements ?? 0; // tổng CẢ khoảng ngày, không phải số dòng trang này
  const [deleting, setDeleting] = useState<VisitRow | null>(null); // lần khám chờ xác nhận xóa
  const [restoreStock, setRestoreStock] = useState(false);

  useEffect(() => setPage(0), [from, to]); // đổi khoảng ngày → về trang đầu

  /**
   * Danh sách PHẲNG, đánh dấu dòng mở đầu mỗi ngày.
   *
   * Trước đây gom thành mỗi ngày một thẻ .card riêng. Đẹp, nhưng chiều cao trang phụ thuộc
   * DỮ LIỆU: 10 lượt cùng một ngày là 1 thẻ, 10 lượt khác ngày là 10 thẻ — chênh nhau gần
   * 500px, nên không thể chọn số dòng mỗi trang sao cho luôn vừa màn hình. Bảng phẳng cho
   * mọi dòng cao bằng nhau; ranh giới ngày giữ lại bằng cách chỉ in ngày ở dòng đầu tiên
   * của ngày đó kèm một vạch đậm phía trên.
   */
  const flat = useMemo(() => {
    // Tính sẵn mảng ngày rồi SO VỚI PHẦN TỬ LIỀN TRƯỚC, không dùng biến tích lũy `let prev`
    // trong closure: React Compiler cấm gán lại biến sau khi render xong ("Cannot reassign
    // variable after render completes") vì nó không thể bảo toàn thứ tự chạy khi memo hóa.
    const days = visits.map((v) => new Date(v.visitDate).toLocaleDateString("vi-VN"));
    return visits.map((v, i) => ({
      v,
      day: days[i],
      firstOfDay: i === 0 || days[i] !== days[i - 1],
    }));
  }, [visits]);

  // Nút filter đang chọn? so khớp from/to với preset.
  const activePreset = QUICK.find(([, n]) => from === daysAgo(n) && to === daysAgo(0))?.[1];

  /**
   * Xóa mềm lần khám; restoreStock do bác sĩ tick trên popup (cộng trả thuốc vào kho).
   *
   * NHẬN lần khám qua tham số, KHÔNG đọc `deleting!.id` trong closure: React Compiler
   * nâng thuộc tính được truy cập trong closure lên làm khóa memo và đọc nó ở MỖI lần
   * render — lúc chưa bấm xóa thì `deleting` là null nên nổ "Cannot read properties of
   * null (reading 'id')" và chết cả trang.
   */
  async function removeVisit(v: VisitRow) {
    await api(`/api/doctor/visits/${v.id}?restoreStock=${restoreStock}`, { method: "DELETE" });
    load();
  }

  function pickPreset(n: number) {
    setFrom(daysAgo(n));
    setTo(daysAgo(0));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h1 className="page-title">Lịch sử khám</h1>
        <div className="flex items-center gap-2 text-sm">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input w-auto" />
          <span className="text-gray-400">→</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input w-auto" />
        </div>
      </div>

      <div className="flex gap-2 mb-4 text-sm flex-wrap">
        {QUICK.map(([label, n]) => (
          <button
            key={label}
            onClick={() => pickPreset(n)}
            className={`chip ${activePreset === n ? "chip-active" : ""}`}
          >
            {label}
          </button>
        ))}
      </div>

      {(loading || pageSize === 0) && <Loading />}
      {!loading && pageSize > 0 && failed && <LoadError onRetry={load} />}
      {!loading && pageSize > 0 && !failed && total === 0 && (
        <EmptyState
          title="Không có lần khám nào trong khoảng này"
          hint="Thử mở rộng khoảng ngày, hoặc chọn nhanh 30 ngày ở trên."
        />
      )}

      {/* Tổng của CẢ khoảng ngày (totalElements), không phải số dòng đang hiện — nếu đếm
          theo trang thì bấm sang trang 2 con số sẽ nhảy lung tung. */}
      {!loading && pageSize > 0 && !failed && total > 0 && (
        <p className="text-xs text-gray-400 mb-2">{total} lượt khám</p>
      )}

      {/* Một bảng duy nhất — xem ghi chú ở `flat` về lý do bỏ cách gom theo thẻ. */}
      {flat.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table table-fixed">
              <thead>
                <tr>
                  <th className="w-28">Ngày</th>
                  <th className="w-20">Giờ</th>
                  <th className="w-48">Bệnh nhân</th>
                  <th>Chẩn đoán</th>
                  <th className="w-28">Lưu ý</th>
                  <th className="w-20"></th>
                </tr>
              </thead>
              <tbody>
                {flat.map(({ v, day, firstOfDay }) => (
                  <tr
                    key={v.id}
                    className={firstOfDay ? "[&>td]:border-t [&>td]:border-t-gray-200" : ""}
                  >
                    <td className="font-medium text-gray-900">{firstOfDay ? day : ""}</td>
                    <td className="tabular-nums text-gray-500">
                      {new Date(v.visitDate).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td>
                      <Link
                        href={`/visits/${v.id}`}
                        className="block truncate font-medium text-ink hover:text-blue-700 hover:underline"
                        title={v.patientName}
                      >
                        {v.patientName}
                      </Link>
                    </td>
                    <td>
                      <Link
                        href={`/visits/${v.id}`}
                        className="flex items-baseline gap-1.5 min-w-0 hover:underline"
                        title={`${v.diagnosisCode} ${v.diagnosisName}`}
                      >
                        <span className="shrink-0 font-medium text-gray-900">{v.diagnosisCode}</span>
                        <span className="truncate text-gray-500">{v.diagnosisName}</span>
                      </Link>
                    </td>
                    <td>
                      {v.hasInjection && (
                        <Badge tone="purple" icon={<IconSyringe size={12} />}>tiêm</Badge>
                      )}
                    </td>
                    <td className="text-right">
                      {/* Nút xóa nằm NGOÀI thẻ Link — lồng button trong <a> vừa sai HTML
                          vừa khiến bấm xóa lại điều hướng sang trang chi tiết. */}
                      <button
                        onClick={() => { setDeleting(v); setRestoreStock(false); }}
                        className="text-sm font-medium text-red-600 hover:underline"
                      >
                        Xóa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Pager page={page} totalPages={totalPages} onPage={setPage} />

      <ConfirmDialog
        open={!!deleting}
        title="Xóa lần khám này?"
        message={
          <>
            {deleting?.patientName} — {deleting?.diagnosisCode} {deleting?.diagnosisName}.
            Lần khám sẽ bị ẩn khỏi lịch sử; đơn thuốc đã in vẫn được lưu trong hệ thống.
          </>
        }
        onConfirm={() => removeVisit(deleting!)}
        onClose={() => setDeleting(null)}
      >
        <label className="flex items-start gap-2 text-sm bg-gray-50 border rounded-lg p-3 cursor-pointer">
          <input
            type="checkbox"
            checked={restoreStock}
            onChange={(e) => setRestoreStock(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium">Hoàn thuốc về kho</span>
            <span className="block text-xs text-gray-500 mt-0.5">
              Tick nếu xóa vì nhập nhầm và thuốc CHƯA phát cho bệnh nhân. Nếu đã phát thuốc rồi
              thì để trống để tồn kho giữ nguyên.
            </span>
          </span>
        </label>
      </ConfirmDialog>
    </div>
  );
}
