"use client";

import { useEffect, useRef, useState } from "react";
import { IconAlert } from "@/components/ui";
import { ApiError } from "@/lib/api";

/**
 * Popup xác nhận dùng chung — THAY cho window.confirm() của trình duyệt.
 * Lý do đổi: confirm() chặn toàn bộ JS, không style được, chữ tiếng Việt bị trình duyệt
 * bọc thêm tên miền, và không hiển thị được lỗi trả về từ API sau khi bấm đồng ý.
 *
 * onConfirm là async: dialog tự khóa nút, chờ API xong mới đóng; API lỗi thì
 * GIỮ dialog và hiện lỗi ngay tại chỗ thay vì đóng im lặng.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Xóa",
  tone = "danger",
  children,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  tone?: "danger" | "primary";
  /** Nội dung phụ trong popup (VD checkbox "hoàn thuốc về kho") */
  children?: React.ReactNode;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Mở lại là reset trạng thái cũ; focus nút Hủy để Enter nhỡ tay không xóa nhầm.
  useEffect(() => {
    if (!open) return;
    setError("");
    setBusy(false);
    cancelRef.current?.focus();
  }, [open]);

  // Esc để đóng (trừ khi đang gọi API dở)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  async function confirm() {
    setBusy(true);
    setError("");
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Thao tác thất bại, thử lại sau.");
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={() => !busy && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex gap-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
              tone === "danger" ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"
            }`}
          >
            <IconAlert size={20} />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-ink">{title}</h3>
            {message && <div className="text-sm text-gray-600 mt-1">{message}</div>}
          </div>
        </div>

        {children && <div className="mt-4">{children}</div>}

        {error && <p className="text-red-600 text-sm mt-3">{error}</p>}

        <div className="flex gap-2 mt-5">
          <button
            onClick={confirm}
            disabled={busy}
            className={tone === "danger" ? "btn-danger" : "btn-primary"}
          >
            {busy ? "Đang xử lý..." : confirmLabel}
          </button>
          <button ref={cancelRef} onClick={onClose} disabled={busy} className="btn-ghost">
            Hủy
          </button>
        </div>
      </div>
    </div>
  );
}
