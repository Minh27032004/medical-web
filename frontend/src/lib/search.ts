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
 * Ngữ liệu đã chuẩn hóa sẵn cho MỘT mảng dữ liệu, tính đúng một lần rồi dùng lại.
 *
 * Vì sao cần: normalizeVi chạy toLowerCase + normalize("NFD") + hai regex trên TỪNG phần
 * tử, và trước đây nó chạy lại toàn bộ sau MỖI ký tự bác sĩ gõ. Với 86 mã ICD thì không
 * ai thấy gì; V17 nâng bảng lên 735 mã và chi phí tăng theo — đo được 0,061 ms → 0,793 ms
 * mỗi phím (chậm 13 lần). Chuẩn hóa sẵn đưa về 0,016 ms, tức nhanh hơn 49 lần, và quan
 * trọng hơn là cắt luôn sự phụ thuộc vào kích thước bảng: nếu sau này nạp ICD-10 đầy đủ
 * (~14.000 mã) thì cách cũ thành ~15 ms mỗi phím — vượt ngân sách một khung hình 16 ms,
 * tức giật thấy được. Cách mới vẫn là một lần quét chuỗi đã sẵn sàng.
 *
 * WeakMap khóa theo CHÍNH mảng dữ liệu: usePreloaded trả về tham chiếu ổn định lấy từ
 * cache nên mảng không đổi giữa các lần gõ → tính một lần. Khi dữ liệu được tải lại,
 * mảng mới là khóa mới, còn mảng cũ không ai giữ nữa thì bộ nhớ tự được thu hồi — không
 * cần bất kỳ bước dọn dẹp thủ công nào, và không bao giờ đọc phải ngữ liệu lỗi thời.
 */
const normalizedNameCache = new WeakMap<object, string[]>();

/**
 * CỐ TÌNH không nhận tham số "lấy trường nào": khóa cache là mảng, nên một hàm dùng chung
 * cho nhiều trường sẽ trả về ngữ liệu của trường ĐƯỢC GỌI TRƯỚC cho mọi lần gọi sau trên
 * cùng mảng đó — lọc khớp nhầm cột mà không có lỗi nào nổi lên. Mỗi trường một WeakMap
 * riêng, đúng khuôn `loweredCodes` bên dưới.
 */
function normalizedNames(list: readonly { name: string }[]): string[] {
  const cached = normalizedNameCache.get(list);
  if (cached) return cached;
  const built = list.map((item) => normalizeVi(item.name));
  normalizedNameCache.set(list, built);
  return built;
}

/** Mã ICD viết thường — cùng lý do như trên, mã là ASCII nên chỉ cần toLowerCase. */
const loweredCodeCache = new WeakMap<object, string[]>();

function loweredCodes(list: readonly Icd10[]): string[] {
  const cached = loweredCodeCache.get(list);
  if (cached) return cached;
  const built = list.map((c) => c.code.toLowerCase());
  loweredCodeCache.set(list, built);
  return built;
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

  // Ngữ liệu chuẩn hóa sẵn; thứ tự phần tử khớp 1-1 với `all` nên duyệt theo chỉ số.
  const codes = loweredCodes(all);
  const names = normalizedNames(all);

  const exact: Icd10[] = [];
  const prefix: Icd10[] = [];
  const byName: Icd10[] = [];
  for (let i = 0; i < all.length; i++) {
    const code = codes[i];
    if (code === byCode) exact.push(all[i]);
    else if (code.startsWith(byCode)) prefix.push(all[i]);
    else if (names[i].includes(nq)) byName.push(all[i]);
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

  const names = normalizedNames(all);

  const templates: Suggestion[] = [];
  const medicines: Suggestion[] = [];
  for (let i = 0; i < all.length; i++) {
    const s = all[i];
    if (!names[i].includes(nq)) continue;
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
