"use client";

import type { Icd10, Medicine, Page, Suggestion } from "@/lib/types";
import { useApiData } from "./useApiData";

/**
 * Dữ liệu gợi ý được TẢI SẴN TOÀN BỘ một lần, để ô autocomplete lọc trong RAM.
 *
 * Trước đây mỗi ký tự gõ ra là một request, mà endpoint tìm kiếm chạy ba query nối tiếp;
 * mỗi vòng tới Supabase ~200-300ms nên danh sách hiện sau gần một giây. Dữ liệu lại rất
 * nhỏ — 86 mã ICD-10, cỡ 180 thuốc mỗi bác sĩ — nên tải hết một lần là đúng hình dạng bài
 * toán. Xem `lib/search.ts` cho phần lọc.
 *
 * Đi qua useApiData nên được hưởng sẵn: hiện ngay từ cache khi quay lại trang, gộp các
 * lượt tải trùng key, và tự xóa cache sau mỗi lần ghi (thêm thuốc mẫu xong là danh sách
 * gợi ý có ngay thuốc đó, không cần F5).
 *
 * Trả mảng rỗng CỐ ĐỊNH khi chưa có dữ liệu — nếu mỗi lần render lại tạo `[]` mới thì mọi
 * useMemo/useEffect nhận nó làm phụ thuộc đều chạy lại vô ích.
 */
const NO_ICD: Icd10[] = [];
const NO_SUGGESTION: Suggestion[] = [];
const NO_MEDICINE: Medicine[] = [];

/** Toàn bộ bảng ICD-10 (dùng chung mọi bác sĩ, gần như bất biến). */
export function useIcd10(): Icd10[] {
  return useApiData<Icd10[]>("/api/doctor/icd10/all").data ?? NO_ICD;
}

/** Toàn bộ gợi ý kê đơn của bác sĩ đang đăng nhập: thuốc mẫu trước, thuốc kho sau. */
export function useSuggestions(): Suggestion[] {
  return useApiData<Suggestion[]>("/api/doctor/suggest/all").data ?? NO_SUGGESTION;
}

/**
 * Toàn bộ thuốc kho — cho ô "liên kết thuốc trong kho" ở trang thuốc mẫu.
 *
 * Dùng lại endpoint danh sách kho có sẵn (size=500) thay vì thêm endpoint mới: trang kho
 * vốn đã gọi đúng key này, nên mở trang kho rồi sang thuốc mẫu là có ngay, khỏi tải lại.
 */
export function useMedicines(): Medicine[] {
  return useApiData<Page<Medicine>>("/api/doctor/medicines?q=&size=500").data?.content ?? NO_MEDICINE;
}
