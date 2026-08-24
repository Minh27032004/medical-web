/**
 * Bộ UI dùng chung: icon lucide-react (nét 1.8, size 16 mặc định — đồng bộ toàn app),
 * Badge, EmptyState, Loading skeleton. Mọi trang import từ "@/components/ui".
 * Component shadcn/ui đầy đủ nằm cùng thư mục: button, input, card, table, skeleton.
 */
import {
  ChevronLeft,
  ChevronRight,
  Droplet,
  Mail,
  PackagePlus,
  Pencil,
  Pill,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Star,
  Stethoscope,
  Syringe,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react";

/* ===== Icon lucide bọc lại: giữ API cũ ({ size }) để các trang không đổi ===== */
function make(Icon: LucideIcon) {
  const Wrapped = ({ size, className }: { size?: number; className?: string }) => (
    <Icon size={size ?? 16} strokeWidth={1.8} className={`shrink-0 ${className ?? ""}`} aria-hidden />
  );
  return Wrapped;
}

export const IconPill = make(Pill);
export const IconSyringe = make(Syringe);
export const IconDroplet = make(Droplet);
export const IconAlert = make(TriangleAlert);
export const IconMail = make(Mail);
export const IconPrinter = make(Printer);
export const IconRefresh = make(RefreshCw);
export const IconPencil = make(Pencil);
export const IconX = make(X);
export const IconPlus = make(Plus);
export const IconSearch = make(Search);
export const IconChevronLeft = make(ChevronLeft);
export const IconChevronRight = make(ChevronRight);
export const IconStethoscope = make(Stethoscope);
export const IconPackagePlus = make(PackagePlus);

/* Sao đặc (đánh dấu ưa dùng) — lucide Star đổ đầy bằng currentColor */
export const IconStar = ({ size }: { size?: number }) => (
  <Star size={size ?? 16} strokeWidth={1.8} fill="currentColor" className="shrink-0" aria-hidden />
);

/* ===== Badge — pill viền nhạt kiểu Untitled UI (lớp .badge trong globals.css) ===== */
export function Badge({
  tone, icon, children, title,
}: {
  tone: "red" | "amber" | "blue" | "purple" | "gray" | "green";
  icon?: React.ReactNode;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <span className={`badge badge-${tone}`} title={title}>
      {icon}
      {children}
    </span>
  );
}

/* ===== Trạng thái rỗng — featured icon + tiêu đề + gợi ý hành động ===== */
export function EmptyState({
  icon, title, hint, action,
}: {
  icon?: React.ReactNode;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center justify-center text-center px-6 py-16">
      <div className="w-12 h-12 rounded-xl border border-gray-200 shadow-xs text-gray-500 flex items-center justify-center mb-4 bg-white">
        {icon ?? <IconSearch size={22} />}
      </div>
      <p className="font-semibold text-gray-900">{title}</p>
      {hint && <p className="text-sm text-gray-500 mt-1 max-w-sm">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/**
 * Báo lỗi TẢI DỮ LIỆU + nút thử lại.
 * Trước đây mọi hàm load() đều .catch(() => {}) nên API hỏng ra màn hình trắng giống hệt
 * "chưa có dữ liệu" — bác sĩ tưởng mất dữ liệu. Render lỗi kèm retry thay vì nuốt.
 */
export function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="card flex flex-col items-center justify-center text-center px-6 py-12">
      <div className="w-12 h-12 rounded-xl border border-red-200 bg-red-50 text-red-600 flex items-center justify-center mb-4">
        <IconAlert size={22} />
      </div>
      <p className="font-semibold text-gray-900">Không tải được dữ liệu</p>
      <p className="text-sm text-gray-500 mt-1 max-w-sm">
        Máy chủ chưa phản hồi hoặc mất kết nối mạng. Dữ liệu vẫn còn nguyên, thử tải lại nhé.
      </p>
      <button onClick={onRetry} className="btn-ghost mt-5">
        <IconRefresh size={15} />
        Thử lại
      </button>
    </div>
  );
}

/* ===== Skeleton đang tải — mô phỏng bảng/danh sách để đỡ giật layout ===== */
export function Loading({ rows = 4 }: { rows?: number }) {
  return (
    <div className="card p-5 space-y-4" aria-label="Đang tải">
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
