/** Cách dùng thuốc: 3 lựa chọn nhanh; "other" mở ô nhập tự do. Dùng chung form đơn thuốc + thuốc mẫu. */
export type UsageMode = "" | "before" | "after" | "other";

/** Nhãn 4 buổi — key trùng field liều trong cả 2 form. */
export const SESSIONS = [
  ["doseMorning", "Sáng"],
  ["doseNoon", "Trưa"],
  ["doseAfternoon", "Chiều"],
  ["doseEvening", "Tối"],
] as const;

/** usageNote (chuỗi lưu DB) → mode + text tự do cho UI. */
export function deriveUsage(note: string | null | undefined): { usageMode: UsageMode; usageCustom: string } {
  if (note === "Trước ăn") return { usageMode: "before", usageCustom: "" };
  if (note === "Sau ăn") return { usageMode: "after", usageCustom: "" };
  if (note && note.trim()) return { usageMode: "other", usageCustom: note };
  return { usageMode: "", usageCustom: "" };
}

/** mode + text → usageNote lưu DB. */
export function usageModeToNote(mode: UsageMode, custom: string): string | null {
  if (mode === "before") return "Trước ăn";
  if (mode === "after") return "Sau ăn";
  if (mode === "other") return custom.trim() || null;
  return null;
}

/** 3 nút chọn cách dùng (label). */
export const USAGE_OPTIONS = [
  ["before", "Trước ăn"],
  ["after", "Sau ăn"],
  ["other", "Khác"],
] as const;

/**
 * Thuốc tiêm / truyền dịch KHÔNG liên quan bữa ăn — trước/sau ăn là vô nghĩa với đường
 * dùng này. Cách dùng cố định luôn, không hỏi bác sĩ, và vẫn in ra đơn thuốc bình thường.
 */
export const INJECTION_NOTE = "Tiêm theo chỉ định";
export const INFUSION_NOTE = "Truyền theo chỉ định";

/** Cách dùng cố định theo loại thuốc; null = thuốc uống, để bác sĩ tự chọn. */
export function fixedUsageNote(injection: boolean, infusion: boolean): string | null {
  if (injection) return INJECTION_NOTE;
  if (infusion) return INFUSION_NOTE;
  return null;
}
