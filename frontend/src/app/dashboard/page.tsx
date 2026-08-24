"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Badge,
  IconAlert,
  IconPackagePlus,
  IconRefresh,
  IconSearch,
  IconStethoscope,
  IconSyringe,
} from "@/components/ui";
import { useApiData } from "@/hooks/useApiData";
import { useDebounced } from "@/hooks/useDebounced";
import type { Medicine, Page, Patient, StockOrderSummary, VisitRow } from "@/lib/types";

/** yyyy-mm-dd theo giờ MÁY BÁC SĨ (sv-SE cho đúng định dạng ISO), giống trang Lịch sử khám. */
function toDateStr(d: Date) {
  return d.toLocaleDateString("sv-SE");
}

/**
 * Trần 100 = trần server (Pageables.of(..., 100) trong DoctorVisitController).
 * Một ngày khám vượt 100 ca là ngoài tầm phòng khám tư, nhưng nếu có thì con số "ca có
 * tiêm/truyền" chỉ đếm trong 100 dòng lấy về — nên chỗ đó có ghi chú riêng bên dưới.
 */
const VISITS_SIZE = 100;

/**
 * Số dòng HIỆN trên dashboard (khác VISITS_SIZE là số dòng TẢI VỀ — vẫn cần cả ngày để
 * đếm đúng "N ca có tiêm/truyền").
 *
 * 5 chứ không phải 7: màn làm việc thật là 1280×720 CSS px (màn 1920×1080 ở mức phóng
 * 150% của Windows), trừ top bar 72px và padding 64px chỉ còn ~464px cho nội dung. Bố cục
 * 7 dòng cần ~684px nên hai thẻ bên phải bị đẩy khuất dưới đáy màn.
 */
const VISIT_ROWS_SHOWN = 5;
const LOW_STOCK_ROWS_SHOWN = 3;

export default function DashboardPage() {
  // Tính một lần cho cả vòng đời trang: dùng trực tiếp new Date() trong khóa cache sẽ tạo
  // chuỗi mới mỗi lần render → useApiData fetch lại vô tận.
  const today = useMemo(() => toDateStr(new Date()), []);

  const visits = useApiData<Page<VisitRow>>(
    `/api/doctor/visits?from=${today}&to=${today}&page=0&size=${VISITS_SIZE}`
  );
  const lowStock = useApiData<Medicine[]>("/api/doctor/medicines/low-stock");
  const pending = useApiData<Page<StockOrderSummary>>(
    "/api/doctor/stock-orders?status=PENDING&page=0&size=2"
  );

  const rows = visits.data?.content ?? [];
  const injectionCount = rows.filter((v) => v.hasInjection).length;
  const lowItems = lowStock.data ?? [];
  const pendingOrders = pending.data?.content ?? [];

  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString("vi-VN", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
    []
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="page-title">Tổng quan</h1>
        <div className="flex items-center gap-3">
          <PatientQuickSearch />
          <Link href="/patients/new" className="btn-primary shrink-0">
            + Bệnh nhân mới
          </Link>
        </div>
      </div>

      {/* ===== 3 ô số liệu ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatTile
          label="Ca khám hôm nay"
          value={visits.data?.totalElements}
          loading={visits.loading}
          failed={visits.failed}
          hint={rows.length === 0 ? "chưa có ca nào" : `${injectionCount} ca tiêm/truyền`}
          icon={<IconStethoscope size={20} />}
          tone={rows.length === 0 ? "gray" : "blue"}
        />
        <StatTile
          label="Thuốc sắp hết"
          value={lowStock.data?.length}
          loading={lowStock.loading}
          failed={lowStock.failed}
          hint="dưới ngưỡng cảnh báo"
          icon={<IconAlert size={20} />}
          tone={lowItems.length > 0 ? "red" : "gray"}
        />
        <StatTile
          label="Đơn nhập chờ xử lý"
          value={pending.data?.totalElements}
          loading={pending.loading}
          failed={pending.failed}
          hint="chưa nhận hàng"
          icon={<IconPackagePlus size={20} />}
          tone={(pending.data?.totalElements ?? 0) > 0 ? "amber" : "gray"}
        />
      </div>

      {/* ===== Lịch khám + cảnh báo ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <section className="lg:col-span-2 min-w-0">
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-gray-100">
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="font-semibold text-gray-900">Ca khám hôm nay</span>
                <span className="text-[13px] text-gray-500 truncate">{todayLabel}</span>
              </div>
              <Link href="/history" className="text-sm font-medium text-blue-700 hover:underline shrink-0">
                Xem lịch sử khám
              </Link>
            </div>

            {visits.loading && <RowsSkeleton rows={5} />}
            {!visits.loading && visits.failed && <InlineError onRetry={visits.reload} />}

            {!visits.loading && !visits.failed && rows.length === 0 && (
              <div className="flex flex-col items-center justify-center text-center px-6 py-16">
                <div className="w-12 h-12 rounded-xl border border-gray-200 shadow-xs text-gray-500 flex items-center justify-center mb-4 bg-white">
                  <IconStethoscope size={22} />
                </div>
                <p className="font-semibold text-gray-900">Chưa có ca khám nào hôm nay</p>
                <p className="text-sm text-gray-500 mt-1 max-w-sm">
                  Tìm bệnh nhân ở ô trên rồi bấm <span className="font-medium text-gray-700">+ Khám</span> để
                  mở ca đầu tiên của ngày.
                </p>
                <Link href="/patients" className="btn-ghost mt-5">
                  Tới danh sách bệnh nhân
                </Link>
              </div>
            )}

            {!visits.loading && !visits.failed && rows.length > 0 && (
              <div className="overflow-x-auto">
                {/*
                  (Mật độ py-2.5 nay là mặc định của .data-table trong globals.css.)
                  table-fixed + truncate: cột "Chẩn đoán" chứa tên ICD-10 dài (vd "Nhiễm
                  khuẩn đường hô hấp trên cấp, không đặc hiệu"). Bảng auto-layout để nó
                  XUỐNG DÒNG, mỗi dòng cao gấp đôi và cả thẻ đội thêm ~90px — đủ để đẩy
                  phần dưới dashboard khuất đáy màn 1280×720. Khóa cột rồi cắt bằng "…";
                  tên đầy đủ vẫn xem được khi bấm vào lần khám.
                */}
                <table className="data-table table-fixed">
                  <thead>
                    <tr>
                      <th className="w-24">Giờ</th>
                      <th className="w-40">Bệnh nhân</th>
                      <th>Chẩn đoán</th>
                      {/*
                        w-32 = 128px, trừ px-5 hai bên còn 88px. Badge có whitespace-nowrap
                        nên nhãn dài hơn 88px sẽ TRÀN ra khỏi ô (table-fixed không cho cột
                        nở) và bật thanh cuộn ngang của overflow-x-auto bao ngoài. Nhãn
                        "Tiêm / truyền" từng chiếm ~115px. Đổi nhãn ở đây thì kiểm lại số này.
                      */}
                      <th className="w-32">Lưu ý</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, VISIT_ROWS_SHOWN).map((v) => (
                      <tr key={v.id}>
                        <td className="font-medium text-gray-900 tabular-nums">
                          {new Date(v.visitDate).toLocaleTimeString("vi-VN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td>
                          <Link
                            href={`/patients/${v.patientId}`}
                            className="block truncate font-semibold text-blue-800 hover:underline"
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
                            <span className="font-semibold text-gray-900 shrink-0">{v.diagnosisCode}</span>
                            <span className="text-gray-600 truncate">{v.diagnosisName}</span>
                          </Link>
                        </td>
                        <td>
                          {v.hasInjection && (
                            <Badge tone="blue" icon={<IconSyringe size={13} />}>
                              Tiêm
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {rows.length > VISIT_ROWS_SHOWN && (
            <p className="text-[13px] text-gray-500 mt-2">
              Đang hiện {VISIT_ROWS_SHOWN} ca sớm nhất trong {rows.length} ca hôm nay — xem đầy đủ ở{" "}
              <Link href="/history" className="text-blue-700 hover:underline">
                Lịch sử khám
              </Link>
              .
            </p>
          )}
        </section>

        {/*
          HAI thẻ rời như phương án A ban đầu (không gộp). Cái giá của nó là 112px chỉ dành
          cho hai tiêu đề 48px cộng khoảng cách 16px giữa hai thẻ — trên ngân sách 500px
          của màn 1280×636 thì đó là hơn 1/5 chiều cao. Bù lại bằng dòng nén 44px:
          padding dọc 4px, tên 14px/20px, dòng phụ 12px/16px.
        */}
        <section className="space-y-4 min-w-0">
          {/* --- Thuốc sắp hết --- */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold text-gray-900">Thuốc sắp hết</span>
                {lowItems.length > 0 && <Badge tone="red">{lowItems.length}</Badge>}
              </div>
              <Link
                href="/stock-orders"
                className="text-sm font-medium text-blue-700 hover:underline shrink-0"
              >
                Tạo đơn nhập
              </Link>
            </div>

            {lowStock.loading && <RowsSkeleton rows={3} />}
            {!lowStock.loading && lowStock.failed && <InlineError onRetry={lowStock.reload} />}
            {!lowStock.loading && !lowStock.failed && lowItems.length === 0 && (
              <p className="px-5 py-6 text-sm text-gray-500 text-center">
                Mọi thuốc đều trên ngưỡng cảnh báo.
              </p>
            )}

            {!lowStock.loading &&
              !lowStock.failed &&
              lowItems.slice(0, LOW_STOCK_ROWS_SHOWN).map((m) => {
                // Thiếu bao nhiêu ĐƠN VỊ NHỎ NHẤT để chạm ngưỡng — con số bác sĩ cần khi đặt
                // hàng. stockBaseQty là số thập phân (BigDecimal ở backend) nên ép về number
                // rồi làm tròn lên: thiếu 0.5 viên vẫn phải nhập 1 viên.
                const missing = Math.max(0, Math.ceil(m.lowStockThreshold - Number(m.stockBaseQty)));
                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-3 px-5 py-1 border-b border-gray-100 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/inventory/${m.id}`}
                        className="block truncate text-sm font-medium leading-5 text-gray-900 hover:underline"
                        title={m.name}
                      >
                        {m.name}
                      </Link>
                      <span className="block truncate text-xs leading-4 text-gray-500">
                        còn {m.stockDisplay} · ngưỡng {m.lowStockThreshold} {m.baseUnitLabel}
                      </span>
                    </div>
                    {missing > 0 && (
                      <span className="text-xs font-medium text-red-700 whitespace-nowrap shrink-0">
                        thiếu {missing}
                      </span>
                    )}
                  </div>
                );
              })}
          </div>

          {/* --- Đơn nhập chờ xử lý --- */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-gray-100">
              <span className="font-semibold text-gray-900">Đơn nhập chờ xử lý</span>
              <Link
                href="/stock-orders"
                className="text-sm font-medium text-blue-700 hover:underline shrink-0"
              >
                Xem tất cả
              </Link>
            </div>

            {pending.loading && <RowsSkeleton rows={2} />}
            {!pending.loading && pending.failed && <InlineError onRetry={pending.reload} />}
            {!pending.loading && !pending.failed && pendingOrders.length === 0 && (
              <p className="px-5 py-6 text-sm text-gray-500 text-center">
                Không có đơn nào đang chờ.
              </p>
            )}

            {!pending.loading &&
              !pending.failed &&
              pendingOrders.map((o) => (
                <div
                  key={o.id}
                  className="flex items-center justify-between gap-3 px-5 py-1 border-b border-gray-100 last:border-b-0"
                >
                  <div className="min-w-0">
                    <Link
                      href="/stock-orders"
                      className="block truncate text-sm font-semibold leading-5 text-gray-900 hover:underline"
                    >
                      {o.code}
                    </Link>
                    <span className="block truncate text-xs leading-4 text-gray-500">
                      {o.itemCount} loại thuốc · {relativeDay(o.createdAt)}
                    </span>
                  </div>
                  <Badge tone="amber">Chờ xử lý</Badge>
                </div>
              ))}
          </div>
        </section>
      </div>
    </div>
  );
}

/* ===================== Thành phần phụ ===================== */

/**
 * Skeleton và báo lỗi bản INLINE — dùng bên trong .card của từng khối.
 * Không dùng <Loading>/<LoadError> chung được: cả hai tự bọc một .card nữa, đặt trong thẻ
 * đã là .card sẽ thành hai lớp viền lồng nhau.
 */
function RowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="p-5 space-y-4" aria-label="Đang tải">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="skeleton w-9 h-9 rounded-lg" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3.5 w-1/3" />
            <div className="skeleton h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function InlineError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="px-5 py-8 flex flex-col items-center text-center">
      <span className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center mb-3">
        <IconAlert size={20} />
      </span>
      <p className="text-sm text-gray-600">Không tải được dữ liệu.</p>
      <button onClick={onRetry} className="btn-ghost mt-3">
        <IconRefresh size={15} />
        Thử lại
      </button>
    </div>
  );
}

/**
 * Ô số liệu dạng NGANG: icon | nhãn trên, số + gợi ý cùng dòng dưới.
 *
 * Bản dọc (nhãn / số / gợi ý xếp chồng) cao 106px. Bản ngang cao 80px vì chiều cao chỉ
 * còn do icon 40px và hai dòng chữ 20+28 quyết định. 26px × 3 ô đó chính là chỗ để giữ
 * HAI thẻ rời bên phải thay vì phải gộp làm một.
 */
function StatTile({
  label, value, hint, icon, tone, loading, failed,
}: {
  label: string;
  value: number | undefined;
  hint: string;
  icon: React.ReactNode;
  tone: "blue" | "red" | "amber" | "gray";
  loading: boolean;
  failed: boolean;
}) {
  const toneClass = {
    blue: "bg-blue-50 text-blue-600",
    red: "bg-red-50 text-red-600",
    amber: "bg-amber-50 text-amber-700",
    gray: "bg-gray-100 text-gray-400",
  }[tone];
  const valueClass = tone === "red" && (value ?? 0) > 0 ? "text-red-700" : "text-gray-900";

  return (
    <div className="card p-4 flex items-center gap-3">
      <span className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${toneClass}`}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium leading-5 text-gray-600 truncate">{label}</p>
        {loading ? (
          <div className="skeleton h-6 w-24 mt-1" />
        ) : failed ? (
          // Không bịa số 0 khi API hỏng — 0 ca khám và "không tải được" là hai chuyện khác.
          <p className="leading-7 truncate">
            <span className="text-[26px] font-semibold text-gray-400">—</span>
            <span className="text-xs text-gray-500 ml-2">không tải được</span>
          </p>
        ) : (
          <p className="leading-7 truncate">
            <span className={`text-[26px] font-semibold tracking-tight ${valueClass}`}>
              {value ?? 0}
            </span>
            <span className="text-xs text-gray-500 ml-2">{hint}</span>
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Tìm nhanh bệnh nhân ngay trên trang Tổng quan — thao tác mở đầu của gần như mọi ca khám.
 * Gọi CÙNG endpoint với trang Bệnh nhân (server tìm không dấu) nên kết quả luôn khớp.
 */
function PatientQuickSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const dq = useDebounced(q, 300);

  // Khóa rỗng → không gọi API. useApiData luôn fetch theo key nên phải tự chặn ở đây.
  const { data, loading } = useApiData<Page<Patient>>(
    dq.trim() ? `/api/doctor/patients?q=${encodeURIComponent(dq.trim())}&page=0&size=5` : ""
  );
  const results = dq.trim() ? (data?.content ?? []) : [];

  return (
    <div className="relative w-64 sm:w-72">
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
        <IconSearch size={18} />
      </span>
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        // blur trễ một nhịp: bấm chuột vào kết quả sẽ blur input TRƯỚC khi click chạy,
        // đóng ngay thì cú bấm rơi vào khoảng không.
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        placeholder="Tìm bệnh nhân theo tên hoặc SĐT..."
        className="input pl-10"
      />

      {open && dq.trim() !== "" && (
        <div className="absolute z-20 mt-1 w-full card overflow-hidden">
          {loading && <p className="px-4 py-3 text-sm text-gray-500">Đang tìm...</p>}
          {!loading && results.length === 0 && (
            <p className="px-4 py-3 text-sm text-gray-500">Không tìm thấy bệnh nhân nào.</p>
          )}
          {results.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
            >
              <Link href={`/patients/${p.id}`} className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-gray-900 truncate">{p.fullName}</span>
                <span className="block text-[13px] text-gray-500">{p.phone || "chưa có SĐT"}</span>
              </Link>
              <Link
                href={`/patients/${p.id}/new-visit`}
                className="text-sm font-medium text-blue-700 hover:underline shrink-0"
              >
                + Khám
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** "hôm nay" / "hôm qua" / "N ngày trước" — mốc thời gian đọc nhanh hơn ngày tuyệt đối. */
function relativeDay(iso: string): string {
  const then = new Date(iso);
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(then)) / 86400000);
  if (days <= 0) return "hôm nay";
  if (days === 1) return "hôm qua";
  return `${days} ngày trước`;
}
