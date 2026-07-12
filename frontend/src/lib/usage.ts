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
