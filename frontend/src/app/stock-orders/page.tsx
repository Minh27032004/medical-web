"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import Pager from "@/components/Pager";
import {
  Badge, EmptyState, IconAlert, IconPill, IconPlus, IconSearch, LoadError, Loading,
} from "@/components/ui";
import { useApiData } from "@/hooks/useApiData";
import { H, useRowsPerPage } from "@/hooks/useRowsPerPage";
import { api, apiDownload, ApiError } from "@/lib/api";
import {
  STOCK_ORDER_STATUS_LABEL,
  type Medicine, type Page, type StockOrder, type StockOrderSummary, type StockSuggestion,
} from "@/lib/types";

/** Một dòng trong đơn đang soạn (chưa lưu). */
interface DraftLine {
  medicineId: string;
  medicineName: string;
  unitName: string;
  qty: string;
  units: { unitName: string; label: string }[];
  stockDisplay: string | null;
}

type Mode = null | "QUICK" | "MANUAL";

/**
 * Bộ lọc trạng thái — "" = tất cả, còn lại truyền thẳng xuống `?status=` của API.
 *
 * Vì sao phải lọc Ở SERVER chứ không lọc mảng `orders` tại chỗ: `pageSize` được đo theo
 * chiều cao màn (khoảng 7 dòng trên 1280×720) và danh sách sắp theo `createdAt desc`, nên
 * lọc tại chỗ chỉ nhìn thấy 7 đơn GẦN NHẤT. Một đơn treo từ tuần trước, nằm dưới 7 đơn đã
 * nhập kho, sẽ không bao giờ hiện ra — trong khi ô "Đơn nhập chờ xử lý" ở trang Tổng quan
 * đếm bằng countQuery trên TOÀN BẢNG nên vẫn tính nó. Đó chính là chỗ hai màn hình lệch số.
 *
 * Backend đã có sẵn `findSummariesByStatus` với countQuery lọc cùng điều kiện, nên
 * totalElements của mỗi chip là con số thật của cả bảng, không phải của trang đang xem.
 */
const STATUS_FILTERS = [
  ["", "Tất cả"],
  ["PENDING", "Chờ xử lý"],
  ["RECEIVED", "Đã nhập kho"],
  ["CANCELLED", "Đã hủy"],
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number][0];

/** Chỉ nhận giá trị nằm trong danh sách trên — `?status=` trên URL là dữ liệu người dùng. */
function parseStatus(raw: string | null): StatusFilter {
  const found = STATUS_FILTERS.find(([value]) => value === raw);
  return found ? found[0] : "";
}

/**
 * Đơn soạn dở giữ trong localStorage — CHỈ mất khi bấm Hủy hoặc xuất file xong.
 *
 * Trước đây tôi dùng sessionStorage vì lo máy phòng khám dùng chung. Sai: sessionStorage
 * chỉ sống trong ĐÚNG MỘT tab, nên mở app ở tab khác là đơn biến mất — đúng triệu chứng
 * chủ dự án báo. Mà nội dung đơn chỉ là tên thuốc + số lượng đặt nhà thuốc, KHÔNG có dữ
 * liệu bệnh nhân, nên giữ lâu không phải vấn đề riêng tư.
 */
const DRAFT_KEY = "medical-web:stock-order-draft";

interface Draft {
  mode: "QUICK" | "MANUAL";
  lines: DraftLine[];
  note: string;
  savedAt?: string;
}

/** Đọc nháp; hỏng hay không đọc được thì coi như không có, đừng để chặn cả trang. */
function readDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft;
    return d?.lines?.length ? d : null;
  } catch {
    localStorage.removeItem(DRAFT_KEY);
    return null;
  }
}

function StockOrdersView() {
  // Danh sách CHỈ tóm tắt — dòng thuốc của từng đơn nạp riêng khi bấm mở.
  // 20 đơn mỗi trang: lịch sử nhập kho chỉ dài thêm chứ không bao giờ ngắn lại, để nguyên
  // thì trang này chậm dần theo tháng mà không có mốc nào báo hiệu.
  const [page, setPage] = useState(0);

  /**
   * URL là NGUỒN SỰ THẬT DUY NHẤT của bộ lọc — cố tình không giữ thêm bản sao trong state.
   *
   * Bản đầu giữ `useState` khởi tạo một lần từ `?status=`, và hỏng ở chiều URL → giao diện:
   * sidebar có link "/stock-orders" KHÔNG kèm tham số (AppShell.tsx), mà App Router đổi
   * query trên cùng một route thì component KHÔNG remount — nên state vẫn giữ "PENDING".
   * Hệ quả: bác sĩ đi từ ô "Đơn nhập chờ xử lý" ở Tổng quan sang đây, rồi bấm "Nhập kho"
   * ở sidebar; URL sạch tham số nhưng danh sách vẫn đang lọc và chip vẫn sáng, không có
   * cách nào gỡ bộ lọc ngoài F5. Nút Back/Forward cũng sai y như vậy.
   *
   * Đọc thẳng từ searchParams mỗi lần render thì cả hai chiều tự đúng, và bonus: link
   * "/stock-orders?status=PENDING" trở thành thứ chia sẻ hay ghim lại được.
   */
  const search = useSearchParams();
  const router = useRouter();
  const status = parseStatus(search.get("status"));

  /**
   * Số đơn mỗi trang = số dòng vừa đúng màn. Trừ: hàng tiêu đề + mb-2, dòng mô tả + mb-5,
   * hàng chip lọc + mb-4, viền thẻ, tiêu đề bảng, phân trang. Trên 1280×720 ra khoảng 6 đơn.
   *
   * KHÔNG trừ chiều cao thẻ "đơn đang soạn": nó chỉ hiện khi bấm Nhập nhanh/Nhập thủ công,
   * và lúc đó bác sĩ đang nhìn vào thẻ soạn đơn chứ không phải danh sách bên dưới.
   */
  const pageSize = useRowsPerPage({
    reserved: H.titleRow + 8 + 20 + 20 + H.chipRow + 16 + H.cardBorder + H.tableHead + H.pager,
    rowHeight: H.tableRow,
  });

  const { data: orderPage, loading, failed: loadFailed, reload: load } =
    useApiData<Page<StockOrderSummary>>(
      pageSize
        ? `/api/doctor/stock-orders?${status ? `status=${status}&` : ""}page=${page}&size=${pageSize}`
        : ""
    );
  const orders = orderPage?.content ?? [];
  const total = orderPage?.totalElements ?? 0; // tổng của CẢ bộ lọc, không phải số dòng trang này

  /**
   * Đổi bộ lọc phải về trang 0: trang 3 của "Tất cả" thường không tồn tại ở "Chờ xử lý".
   * `replace` chứ không `push` — bộ lọc là cách xem, không phải một bước điều hướng đáng
   * để Back phải đi ngược qua từng chip đã bấm.
   */
  function pickStatus(next: StatusFilter) {
    setPage(0);
    router.replace(next ? `/stock-orders?status=${next}` : "/stock-orders", { scroll: false });
  }

  const [mode, setMode] = useState<Mode>(null);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [restored, setRestored] = useState(false); // đơn vừa được khôi phục từ lần trước
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const latest = useRef<Draft | null>(null); // bản nháp mới nhất, dùng lúc rời trang
  const [openId, setOpenId] = useState<string | null>(null); // đơn đang mở chi tiết
  const [receiving, setReceiving] = useState<StockOrderSummary | null>(null);
  const [cancelling, setCancelling] = useState<StockOrderSummary | null>(null);

  /** Nhập nhanh: kéo danh sách thuốc sắp hết, mỗi thuốc 1 đơn vị lớn nhất. */
  async function startQuick() {
    setError("");
    setBusy(true);
    try {
      const sug = await api<StockSuggestion[]>("/api/doctor/stock-orders/quick-suggestions");
      if (sug.length === 0) {
        setError("Không có thuốc nào dưới ngưỡng cảnh báo. Dùng \"Nhập thủ công\" nếu vẫn muốn đặt.");
        setBusy(false);
        return;
      }
      setLines(sug.map((s) => ({
        medicineId: s.medicineId,
        medicineName: s.medicineName,
        unitName: s.defaultUnitName,
        qty: String(s.defaultQty),
        units: s.units,
        stockDisplay: s.stockDisplay,
      })));
      setNote("");
      setRestored(false);
      setMode("QUICK");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không tải được danh sách thuốc sắp hết");
    } finally {
      setBusy(false);
    }
  }

  function startManual() {
    setError("");
    setLines([]);
    setNote("");
    setRestored(false);
    setMode("MANUAL");
  }

  /**
   * Khôi phục nháp — trong effect (không phải khởi tạo useState) vì trang này được
   * prerender: đọc localStorage lúc render sẽ lệch giữa HTML server và client (hydration).
   */
  useEffect(() => {
    const d = readDraft();
    if (!d) return;
    setMode(d.mode);
    setLines(d.lines);
    setNote(d.note ?? "");
    setSavedAt(d.savedAt ?? null);
    setRestored(true);
  }, []);

  // Ghi lại mỗi khi đơn đổi. mode = null nghĩa là không có đơn nào đang soạn.
  useEffect(() => {
    if (!mode) return;
    const draft: Draft = { mode, lines, note, savedAt: new Date().toISOString() };
    latest.current = draft;
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [mode, lines, note]);

  /**
   * Ghi thêm một lần lúc rời trang. Effect ở trên chạy SAU khi vẽ xong; gõ xong mà bấm
   * ngay sang mục khác thì thay đổi cuối có thể chưa kịp lưu. Ref giữ bản mới nhất nên
   * cleanup không dính giá trị cũ của closure.
   */
  useEffect(() => () => {
    if (latest.current) localStorage.setItem(DRAFT_KEY, JSON.stringify(latest.current));
  }, []);

  function closeDraft() {
    setMode(null);
    setLines([]);
    setNote("");
    setError("");
    setRestored(false);
    setSavedAt(null);
    latest.current = null;
    localStorage.removeItem(DRAFT_KEY);
  }

  function addLine(m: Medicine) {
    if (lines.some((l) => l.medicineId === m.id)) {
      // Không im lặng bỏ qua — bác sĩ bấm mà không thấy gì sẽ tưởng nút hỏng.
      setError(`"${m.name}" đã có trong đơn — sửa số lượng ở dòng bên dưới.`);
      return;
    }
    setError("");
    setLines((ls) => [...ls, {
      medicineId: m.id,
      medicineName: m.name,
      unitName: m.units[0]?.unitName ?? m.baseUnit,
      qty: "1",
      units: m.units.map((u) => ({ unitName: u.unitName, label: u.label })),
      stockDisplay: m.stockDisplay,
    }]);
  }

  function updateLine(i: number, patch: Partial<DraftLine>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  /** Lưu đơn (trạng thái chờ) rồi tải file .xlsx về. */
  async function exportDraft() {
    setError("");
    const items = lines
      .filter((l) => Number(l.qty) > 0)
      .map((l) => ({ medicineId: l.medicineId, unitName: l.unitName, qty: Number(l.qty) }));
    if (items.length === 0) {
      setError("Nhập số lượng cho ít nhất 1 dòng thuốc");
      return;
    }
    setBusy(true);
    let created: StockOrder;
    try {
      created = await api<StockOrder>("/api/doctor/stock-orders", {
        method: "POST",
        body: JSON.stringify({ source: mode, note: note.trim() || null, items }),
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Lưu đơn thất bại");
      setBusy(false);
      return;
    }

    // Đơn ĐÃ LƯU — đóng form ngay, trước khi tải file. Nếu gộp chung try/catch, một lỗi
    // lúc tải file sẽ giữ form mở với nguyên các dòng cũ, bác sĩ bấm "Xuất file" lần nữa
    // là tạo ĐƠN THỨ HAI trùng nội dung; xác nhận cả hai thì tồn kho cộng gấp đôi.
    closeDraft();
    // Đơn mới đứng đầu danh sách (sắp theo ngày tạo giảm dần). Đang đứng ở trang 2 mà chỉ
    // reload thì bác sĩ vừa lưu xong lại không thấy đơn đâu — về trang đầu để nó hiện ra.
    if (page === 0) load();
    else setPage(0);
    try {
      await apiDownload(`/api/doctor/stock-orders/${created.id}/export`, `${created.code}.xlsx`);
    } catch {
      setError(
        `Đã lưu đơn ${created.code} nhưng tải file không thành công. `
          + "Bấm \"Tải file\" ở đơn bên dưới để tải lại."
      );
    } finally {
      setBusy(false);
    }
  }

  /**
   * Tải lại sau khi một đơn ĐỔI TRẠNG THÁI — và về trang đầu nếu đang đứng ở trang trong.
   *
   * Trước khi có bộ lọc thì `load()` là đủ: danh sách "Tất cả" không bao giờ ngắn đi (hủy
   * đơn chỉ đổi status sang CANCELLED chứ không xóa dòng). Có bộ lọc thì tập kết quả CO
   * LẠI được, và sinh ra một cái bẫy: đang lọc "Chờ xử lý", đứng ở trang cuối chỉ còn một
   * đơn, bấm "Đã nhận hàng" → đơn rời khỏi bộ lọc → trang đó không còn tồn tại, nhưng
   * `page` vẫn giữ số cũ nên API trả về rỗng. Tệ hơn: Pager ẩn hẳn khi chỉ còn một trang
   * (xem Pager.tsx) nên KHÔNG CÒN NÚT NÀO để quay lại — bác sĩ kẹt ở màn hình "không có
   * đơn nào" trong khi dòng chữ ngay phía trên vẫn ghi tổng số đơn.
   *
   * Dùng đúng cách `create` đã dùng ở trên, vì đây là cùng một loại rủi ro.
   */
  function reloadFromStart() {
    if (page === 0) load();
    else setPage(0);
  }

  async function receive(o: StockOrderSummary) {
    await api(`/api/doctor/stock-orders/${o.id}/receive`, { method: "POST" });
    reloadFromStart();
  }

  async function cancel(o: StockOrderSummary) {
    await api(`/api/doctor/stock-orders/${o.id}`, { method: "DELETE" });
    reloadFromStart();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
        <h1 className="page-title">Nhập kho</h1>
        {!mode && (
          <div className="flex gap-2">
            <button onClick={startQuick} disabled={busy} className="btn-primary">
              <IconAlert size={16} />
              {busy ? "Đang tải..." : "Nhập nhanh"}
            </button>
            <button onClick={startManual} className="btn-ghost">
              <IconPlus />
              Nhập thủ công
            </button>
          </div>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-5">
        Lập đơn đặt thuốc, xuất file gửi nhà thuốc. Tồn kho <strong>chỉ tăng khi bạn xác nhận</strong>{" "}
        đã nhận đủ hàng — đơn đang chờ không ảnh hưởng số tồn.
      </p>

      {/*
        Số đơn nằm CÙNG hàng với chip, không xuống dòng riêng: hàng chip đã được tính vào
        `reserved` của useRowsPerPage, thêm một dòng nữa là lệch phép đo và đẩy phân trang
        khuất đáy màn.
      */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {STATUS_FILTERS.map(([value, label]) => (
            <button
              key={value || "ALL"}
              onClick={() => pickStatus(value)}
              className={`chip ${status === value ? "chip-active" : ""}`}
            >
              {label}
            </button>
          ))}
        </div>
        {!loading && pageSize > 0 && !loadFailed && total > 0 && (
          <span className="text-sm text-gray-500 tabular-nums shrink-0">{total} đơn</span>
        )}
      </div>

      {!mode && error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      {mode && (
        <DraftCard
          mode={mode}
          restored={restored}
          savedAt={savedAt}
          lines={lines}
          note={note}
          busy={busy}
          error={error}
          onNote={setNote}
          onUpdateLine={updateLine}
          onRemoveLine={(i) => setLines((ls) => ls.filter((_, idx) => idx !== i))}
          onAddLine={addLine}
          onExport={exportDraft}
          onCancel={closeDraft}
        />
      )}

      {(loading || pageSize === 0) && <Loading />}
      {!loading && pageSize > 0 && loadFailed && <LoadError onRetry={load} />}

      {!loading && pageSize > 0 && !loadFailed && orders.length === 0 && !mode && (
        status ? (
          // Trống vì BỘ LỌC, không phải vì chưa từng có đơn — nói đúng chuyện đang xảy ra
          // thay vì mời bác sĩ lập đơn mới trong khi họ đang đi tìm một đơn cũ.
          <EmptyState
            title={`Không có đơn nào ở trạng thái “${STATUS_FILTERS.find(([v]) => v === status)![1]}”`}
            hint="Bấm “Tất cả” để xem toàn bộ lịch sử nhập kho."
          />
        ) : (
          <EmptyState
            title="Chưa có đơn nhập kho nào"
            hint="Bấm “Nhập nhanh” để dựng đơn từ các thuốc đang sắp hết, hoặc “Nhập thủ công” để tự chọn."
          />
        )
      )}

      {!loading && pageSize > 0 && !loadFailed && orders.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Đơn nhập kho</th>
                  <th className="w-44">Ngày tạo</th>
                  <th className="w-36">Trạng thái</th>
                  <th className="w-64"></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <OrderRows
                    key={o.id}
                    order={o}
                    open={openId === o.id}
                    onToggle={() => setOpenId(openId === o.id ? null : o.id)}
                    onExport={() => apiDownload(`/api/doctor/stock-orders/${o.id}/export`, `${o.code}.xlsx`)}
                    onReceive={o.status === "PENDING" ? () => setReceiving(o) : undefined}
                    onCancel={o.status === "PENDING" ? () => setCancelling(o) : undefined}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Pager page={page} totalPages={orderPage?.totalPages ?? 1} onPage={setPage} />

      <ConfirmDialog
        open={!!receiving}
        title="Bạn có chắc đã nhập đủ thuốc và số lượng theo đơn chưa?"
        message={
          <>
            Đơn <strong>{receiving?.code}</strong> gồm {receiving?.itemCount} dòng thuốc. Xác nhận
            sẽ <strong>cộng ngay số lượng này vào tồn kho</strong> và không hoàn tác được. Nếu nhận
            thiếu, hãy hủy đơn rồi chỉnh tồn bằng nút “Nhập / chỉnh” trong Kho thuốc.
          </>
        }
        confirmLabel="Xác nhận nhập thuốc"
        tone="primary"
        onConfirm={() => receive(receiving!)}
        onClose={() => setReceiving(null)}
      />

      <ConfirmDialog
        open={!!cancelling}
        title={`Hủy đơn ${cancelling?.code}?`}
        message="Đơn sẽ chuyển sang trạng thái đã hủy. Tồn kho không thay đổi vì đơn chưa từng được cộng."
        confirmLabel="Hủy đơn"
        onConfirm={() => cancel(cancelling!)}
        onClose={() => setCancelling(null)}
      />
    </div>
  );
}

/**
 * useSearchParams() bắt buộc phải nằm trong <Suspense>: nếu không, Next phải bỏ hẳn việc
 * prerender trang này vì tham số URL chỉ biết được lúc chạy. Cùng khuôn với trang khám mới.
 */
export default function StockOrdersPage() {
  return (
    <Suspense fallback={<Loading />}>
      <StockOrdersView />
    </Suspense>
  );
}

/* ===================== Đơn đang soạn ===================== */

function DraftCard({
  mode, restored, savedAt, lines, note, busy, error,
  onNote, onUpdateLine, onRemoveLine, onAddLine, onExport, onCancel,
}: {
  mode: "QUICK" | "MANUAL";
  restored: boolean;
  savedAt: string | null;
  lines: DraftLine[];
  note: string;
  busy: boolean;
  error: string;
  onNote: (v: string) => void;
  onUpdateLine: (i: number, patch: Partial<DraftLine>) => void;
  onRemoveLine: (i: number) => void;
  onAddLine: (m: Medicine) => void;
  onExport: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="card p-5 mb-6">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
        <p className="font-semibold text-ink">
          {mode === "QUICK" ? "Đơn nhập nhanh — thuốc đang sắp hết" : "Đơn nhập thủ công"}
        </p>
        <span className="text-sm text-gray-500">{lines.length} dòng thuốc</span>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        {mode === "QUICK"
          ? "Mặc định 1 đơn vị lớn nhất cho mỗi thuốc — chỉnh lại số lượng và đơn vị nếu cần."
          : "Tìm thuốc trong kho rồi thêm vào đơn."}
      </p>

      {restored && (
        <p className="text-sm bg-blue-50 border border-blue-200 text-blue-900 rounded-lg px-3 py-2 mb-3">
          Đơn soạn dở của bạn được giữ lại
          {savedAt && ` (lưu lúc ${new Date(savedAt).toLocaleString("vi-VN", {
            hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit",
          })})`}. Bấm <strong>Hủy</strong> nếu muốn bỏ và làm lại từ đầu.
        </p>
      )}

      {mode === "MANUAL" && <MedicineSearch onPick={onAddLine} />}

      {lines.length > 0 && (
        <div className="overflow-x-auto mt-4">
          <table className="data-table">
            <thead>
              <tr>
                <th>Thuốc</th>
                <th className="w-40">Tồn hiện tại</th>
                <th className="w-32">Số lượng</th>
                <th className="w-36">Đơn vị</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={l.medicineId}>
                  <td className="font-medium text-ink">{l.medicineName}</td>
                  <td className="text-gray-500">{l.stockDisplay ?? "—"}</td>
                  <td>
                    <input
                      type="number" min={0} step="any"
                      value={l.qty}
                      onChange={(e) => onUpdateLine(i, { qty: e.target.value })}
                      className="input-sm w-24"
                    />
                  </td>
                  <td>
                    <select
                      value={l.unitName}
                      onChange={(e) => onUpdateLine(i, { unitName: e.target.value })}
                      className="input-sm w-28"
                    >
                      {l.units.map((u) => (
                        <option key={u.unitName} value={u.unitName}>{u.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="text-right">
                    <button
                      onClick={() => onRemoveLine(i)}
                      className="text-gray-400 hover:text-red-600"
                      aria-label="Bỏ dòng này"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {lines.length === 0 && mode === "MANUAL" && (
        <p className="text-sm text-gray-500 mt-4">Chưa có thuốc nào trong đơn.</p>
      )}

      <input
        value={note}
        onChange={(e) => onNote(e.target.value)}
        placeholder="Ghi chú cho nhà thuốc (tùy chọn): giao trước thứ 6, ưu tiên hàng cận date..."
        className="input mt-4"
      />

      {error && <p className="text-red-600 text-sm mt-3">{error}</p>}

      <div className="flex gap-2 mt-4">
        <button onClick={onExport} disabled={busy} className="btn-primary">
          {busy ? "Đang xuất..." : "Xuất file"}
        </button>
        <button onClick={onCancel} disabled={busy} className="btn-ghost">Hủy</button>
      </div>
    </div>
  );
}

/* ===================== Tìm thuốc (nhập thủ công) ===================== */

function MedicineSearch({ onPick }: { onPick: (m: Medicine) => void }) {
  const [q, setQ] = useState("");
  const [options, setOptions] = useState<Medicine[]>([]);

  useEffect(() => {
    const kw = q.trim();
    if (!kw) { setOptions([]); return; }
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      api<Page<Medicine>>(`/api/doctor/medicines?q=${encodeURIComponent(kw)}&size=15`)
        .then((p) => setOptions(p.content))
        .catch(() => {});
    }, 250);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [q]);

  return (
    <div>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          <IconSearch size={16} />
        </span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Gõ tên thuốc để thêm vào đơn..."
          className="input pl-9"
        />
      </div>
      {options.length > 0 && (
        <div className="border border-gray-200 rounded-lg mt-2 divide-y max-h-56 overflow-y-auto">
          {options.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => { onPick(m); setQ(""); setOptions([]); }}
              className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm flex items-center justify-between gap-3"
            >
              <span className="font-medium text-ink">{m.name}</span>
              <span className="text-xs text-gray-500">
                tồn {m.stockDisplay}
                {m.lowStock && <span className="text-red-600 font-medium"> · sắp hết</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ===================== Một đơn: dòng tóm tắt + hàng chi tiết ===================== */

/**
 * Danh sách chỉ hiện MÃ ĐƠN + NGÀY TẠO. Trước đây trải hết dòng thuốc ra ngoài nên 5 đơn
 * là kín màn hình, không so sánh được đơn nào với đơn nào. Chi tiết mở khi bấm vào dòng.
 */
function OrderRows({
  order, open, onToggle, onExport, onReceive, onCancel,
}: {
  order: StockOrderSummary;
  open: boolean;
  onToggle: () => void;
  onExport: () => void;
  onReceive?: () => void;
  onCancel?: () => void;
}) {
  const tone = order.status === "PENDING" ? "amber" : order.status === "RECEIVED" ? "blue" : "red";
  return (
    <>
      <tr className={open ? "bg-blue-50/40" : ""}>
        <td>
          <button onClick={onToggle} className="flex items-center gap-2 text-left group">
            <span className={`text-gray-400 transition-transform ${open ? "rotate-90" : ""}`}>▸</span>
            <span className="font-semibold text-ink group-hover:text-blue-700 group-hover:underline">
              Đơn {order.code}
            </span>
            <span className="text-xs text-gray-400">({order.itemCount} thuốc)</span>
          </button>
        </td>
        <td className="text-gray-600">
          {new Date(order.createdAt).toLocaleDateString("vi-VN")}
          <span className="text-gray-400 text-xs">
            {" "}
            {new Date(order.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </td>
        <td><Badge tone={tone}>{STOCK_ORDER_STATUS_LABEL[order.status]}</Badge></td>
        <td className="text-right whitespace-nowrap">
          <button onClick={onExport} className="text-sm font-medium text-blue-700 hover:underline mr-3">
            Tải file
          </button>
          {onReceive && (
            <button onClick={onReceive} className="btn-primary py-1.5 px-3 text-sm mr-2">
              Xác nhận nhập thuốc
            </button>
          )}
          {onCancel && (
            <button onClick={onCancel} className="text-sm font-medium text-red-600 hover:underline">
              Hủy
            </button>
          )}
        </td>
      </tr>

      {/* Chi tiết chỉ MOUNT khi mở → chỉ lúc đó mới gọi API lấy dòng thuốc. */}
      {open && (
        <tr>
          <td colSpan={4} className="bg-gray-50 p-0">
            <OrderDetail orderId={order.id} />
          </td>
        </tr>
      )}
    </>
  );
}

/** Dòng thuốc của một đơn — tải riêng khi bác sĩ mở đơn, sau đó nằm cache nên mở lại là tức thì. */
function OrderDetail({ orderId }: { orderId: string }) {
  const { data, loading, failed, reload } = useApiData<StockOrder>(
    `/api/doctor/stock-orders/${orderId}`
  );

  if (loading && !data) {
    return <p className="px-5 py-4 text-sm text-gray-500">Đang tải danh sách thuốc...</p>;
  }
  if (failed && !data) {
    return (
      <p className="px-5 py-4 text-sm text-red-600">
        Không tải được danh sách thuốc.{" "}
        <button onClick={reload} className="underline font-medium">Thử lại</button>
      </p>
    );
  }

  return (
    <div className="px-5 py-4">
      <ul className="space-y-2">
        {data?.items.map((it, i) => (
          <li key={i} className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-3 py-2">
            <span className="w-11 h-11 rounded-lg bg-gray-100 overflow-hidden shrink-0 relative">
              {it.imageUrl ? (
                <Image src={it.imageUrl} alt="" fill sizes="44px" className="object-cover" />
              ) : (
                <span className="w-full h-full flex items-center justify-center text-gray-400">
                  <IconPill size={20} />
                </span>
              )}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-medium text-ink truncate">{it.medicineName}</span>
              {it.currentStockDisplay && (
                <span className="block text-xs text-gray-500">
                  tồn hiện tại: {it.currentStockDisplay}
                  {it.lowStock && <span className="text-red-600 font-medium"> · sắp hết</span>}
                </span>
              )}
            </span>
            <span className="font-semibold text-ink shrink-0">
              {it.qty} {it.unitLabel}
            </span>
          </li>
        ))}
      </ul>
      {data?.note && <p className="text-xs text-gray-500 mt-3">Ghi chú: {data.note}</p>}
    </div>
  );
}
