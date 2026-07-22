import type { Icd10, Suggestion } from "@/lib/types";

/**
 * Lọc gợi ý NGAY TRONG RAM thay vì hỏi server mỗi lần gõ.
 *
 * Trước đây mỗi ký tự gõ ra là một request, mà cả hai endpoint đều chạy ba query nối tiếp
 * (xem Icd10Controller.search và TemplateService.suggest). Mỗi vòng tới Supabase tốn
 * ~200-300ms nên danh sách hiện sau gần một giây, cộng debounce 250ms nữa. Dữ liệu thì
 * bé tí: 86 mã ICD-10, cỡ 180 thuốc mỗi bác sĩ. Tải một lần rồi lọc tại chỗ là đúng hình
 * dạng bài toán.
 *
 * Các hàm ở đây phải cho ra CÙNG kết quả với query SQL cũ, nếu không bác sĩ sẽ thấy gợi ý
 * đổi khác sau khi nâng cấp — nên mỗi hàm ghi rõ nó đang tái hiện câu SQL nào.
 */

/**
 * Bỏ dấu tiếng Việt để so khớp — tái hiện `extensions.unaccent(lower(...))` của Postgres.
 *
 * NFD tách nguyên âm có dấu thành "chữ gốc + dấu tổ hợp" rồi ta xóa dấu. Riêng "đ" KHÔNG
 * phải nguyên âm có dấu tổ hợp — NFD để nguyên — nên phải thay tay, đúng như bộ luật mặc
 * định của unaccent vẫn map đ → d. Thiếu dòng này thì gõ "dau dạ day" không ra "đau dạ dày".
 */
export function normalizeVi(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d");
}

/** Có chứa từ khóa không, bỏ qua dấu và hoa/thường — tương đương `unaccent(lower(x)) like '%q%'`. */
export function containsVi(text: string, normalizedQuery: string): boolean {
  return normalizeVi(text).includes(normalizedQuery);
}

/**
 * Lọc ICD-10 — tái hiện y hệt thứ tự ưu tiên của Icd10Controller.search:
 * khớp mã chính xác → mã bắt đầu bằng → tên có chứa (không dấu), khử trùng, cắt còn 20.
 *
 * Giữ nguyên thứ tự đó là quan trọng: bác sĩ quen gõ "J02" và thấy đúng mã đó nhảy lên
 * đầu; đảo thành tìm-theo-tên-trước là phá thói quen đã hình thành.
 */
export function filterIcd(all: Icd10[], query: string, limit = 20): Icd10[] {
  const q = query.trim();
  if (!q) return [];
  const nq = normalizeVi(q);
  const byCode = nq;

  const exact: Icd10[] = [];
  const prefix: Icd10[] = [];
  const byName: Icd10[] = [];
  for (const c of all) {
    const code = c.code.toLowerCase();
    if (code === byCode) exact.push(c);
    else if (code.startsWith(byCode)) prefix.push(c);
    else if (containsVi(c.name, nq)) byName.push(c);
  }
  return [...exact, ...prefix, ...byName].slice(0, limit);
}

/**
 * Lọc gợi ý kê đơn — tái hiện TemplateService.suggest: thuốc mẫu trước (tối đa 5), rồi
 * thuốc kho (tối đa 15), khớp tên không dấu, không lặp cùng một thuốc kho.
 *
 * `all` từ /suggest/all đã xếp sẵn mẫu trước kho sau nên chỉ cần giữ nguyên thứ tự.
 */
export function filterSuggestions(
  all: Suggestion[],
  query: string,
  { maxTemplates = 5, maxMedicines = 15 } = {}
): Suggestion[] {
  const q = query.trim();
  if (!q) return [];
  const nq = normalizeVi(q);

  const templates: Suggestion[] = [];
  const medicines: Suggestion[] = [];
  for (const s of all) {
    if (!containsVi(s.name, nq)) continue;
    if (s.type === "TEMPLATE") {
      if (templates.length < maxTemplates) templates.push(s);
    } else if (medicines.length < maxMedicines) {
      medicines.push(s);
    }
  }
  // Mẫu đã gắn thuốc kho nào thì bỏ dòng thuốc kho đó đi, tránh hiện hai lần cùng một thuốc.
  const covered = new Set(templates.map((t) => t.medicineId).filter(Boolean));
  return [...templates, ...medicines.filter((m) => !covered.has(m.medicineId))];
}
