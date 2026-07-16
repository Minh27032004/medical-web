/**
 * Bộ UI dùng chung: icon SVG (thay emoji — render đồng nhất mọi máy, thẳng baseline),
 * Badge, EmptyState, Loading skeleton. Mọi trang dùng từ đây, không tự chế tại chỗ.
 */

/* ===== Icon line (stroke) — cùng nét 1.8 với icon sidebar ===== */
function Svg({ size = 16, children, className }: { size?: number; children: React.ReactNode; className?: string }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className={`shrink-0 ${className ?? ""}`} aria-hidden
    >
      {children}
    </svg>
  );
}

export const IconPill = ({ size }: { size?: number }) => (
  <Svg size={size}><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" /><path d="m8.5 8.5 7 7" /></Svg>
);
export const IconSyringe = ({ size }: { size?: number }) => (
  <Svg size={size}><path d="m18 2 4 4" /><path d="m17 7 3-3" /><path d="M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5" /><path d="m9 11 4 4" /><path d="m5 19-3 3" /><path d="m14 4 6 6" /></Svg>
);
export const IconAlert = ({ size }: { size?: number }) => (
  <Svg size={size}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></Svg>
);
export const IconStar = ({ size }: { size?: number }) => (
  <svg width={size ?? 16} height={size ?? 16} viewBox="0 0 24 24" fill="currentColor" className="shrink-0" aria-hidden>
    <path d="M11.05 3.7c.3-.92 1.6-.92 1.9 0l1.66 5.1a1 1 0 0 0 .95.7h5.37c.96 0 1.36 1.24.58 1.81l-4.34 3.15a1 1 0 0 0-.36 1.12l1.65 5.1c.3.92-.75 1.68-1.53 1.12l-4.34-3.16a1 1 0 0 0-1.18 0l-4.34 3.16c-.78.56-1.83-.2-1.53-1.12l1.65-5.1a1 1 0 0 0-.36-1.12L2.49 11.3c-.78-.57-.38-1.81.58-1.81h5.37a1 1 0 0 0 .95-.69l1.66-5.1Z" />
  </svg>
);
export const IconMail = ({ size }: { size?: number }) => (
  <Svg size={size}><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></Svg>
);
export const IconPrinter = ({ size }: { size?: number }) => (
  <Svg size={size}><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6" /><rect x="6" y="14" width="12" height="8" rx="1" /></Svg>
);
export const IconRefresh = ({ size }: { size?: number }) => (
  <Svg size={size}><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M3 21v-5h5" /></Svg>
);
export const IconX = ({ size }: { size?: number }) => (
  <Svg size={size}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></Svg>
);
export const IconPlus = ({ size }: { size?: number }) => (
  <Svg size={size}><path d="M5 12h14" /><path d="M12 5v14" /></Svg>
);
export const IconSearch = ({ size }: { size?: number }) => (
  <Svg size={size}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></Svg>
);
export const IconChevronLeft = ({ size }: { size?: number }) => (
  <Svg size={size}><path d="m15 18-6-6 6-6" /></Svg>
);
export const IconChevronRight = ({ size }: { size?: number }) => (
  <Svg size={size}><path d="m9 18 6-6-6-6" /></Svg>
);

/* ===== Badge — dùng lớp .badge trong globals.css ===== */
export function Badge({
  tone, icon, children, title,
}: {
  tone: "red" | "amber" | "blue" | "purple" | "gray";
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

/* ===== Trạng thái rỗng — icon tròn + tiêu đề + gợi ý hành động ===== */
export function EmptyState({
  icon, title, hint, action,
}: {
  icon?: React.ReactNode;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center justify-center text-center px-6 py-14">
      <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mb-3">
        {icon ?? <IconSearch size={22} />}
      </div>
      <p className="font-semibold text-ink">{title}</p>
      {hint && <p className="text-sm text-gray-500 mt-1 max-w-sm">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ===== Skeleton đang tải — mô phỏng bảng/danh sách để đỡ giật layout ===== */
export function Loading({ rows = 4 }: { rows?: number }) {
  return (
    <div className="card p-4 space-y-3" aria-label="Đang tải">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="skeleton w-9 h-9 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <div className="skeleton h-3.5 w-1/3" />
            <div className="skeleton h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
