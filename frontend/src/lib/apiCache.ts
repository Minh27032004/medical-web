/**
 * Cache dữ liệu GET dùng chung cả phiên (chỉ trong RAM của tab).
 *
 * Tách riêng khỏi api.ts và useApiData.ts để cả hai cùng dùng mà không import vòng.
 * KHÔNG dùng localStorage: dữ liệu bệnh nhân không nên nằm lại trên máy sau khi đóng tab.
 */
const cache = new Map<string, unknown>();

/**
 * Trần số mục — quá thì bỏ mục LÂU KHÔNG ĐỤNG NHẤT (LRU).
 *
 * Vì sao cần trần: key là nguyên đường dẫn kèm query, nên mỗi từ khóa tìm kiếm và mỗi
 * trang sinh một mục mới và nằm lại tới khi đóng tab. Nặng nhất là kho thuốc — nó tải
 * size=500 nên MỖI từ khóa là một mảng 500 bản ghi. Gõ tìm cả buổi thì RAM tab phình dần,
 * và dữ liệu bệnh nhân cũng nằm lại lâu hơn mức cần — hơi ngược với lý do không dùng
 * localStorage ở trên.
 *
 * 40 là ước lượng: đủ giữ trọn các trang bác sĩ đi tới đi lui trong một ca khám, mà xấu
 * nhất (toàn mục kho 500 dòng) vẫn chỉ vài MB.
 */
const MAX_ENTRIES = 40;

/** Map giữ thứ tự chèn: xóa rồi set lại = đẩy mục xuống cuối hàng, tức "vừa mới đụng". */
function touch(key: string, value: unknown): void {
  cache.delete(key);
  cache.set(key, value);
}

export function cacheGet<T>(key: string): T | undefined {
  if (!cache.has(key)) return undefined;
  const value = cache.get(key) as T | undefined;
  touch(key, value); // đọc cũng tính là đụng, nếu không thì thành FIFO chứ không phải LRU
  return value;
}

export function cacheHas(key: string): boolean {
  return cache.has(key);
}

export function cacheSet(key: string, value: unknown): void {
  touch(key, value);
  // keys().next() = mục ở đầu hàng = lâu không đụng nhất.
  if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value!);
}

/**
 * Xóa TOÀN BỘ cache — gọi sau mỗi lần ghi dữ liệu thành công (POST/PUT/PATCH/DELETE).
 *
 * Vì sao xóa sạch thay vì xóa đúng phần liên quan: một thao tác ghi thường đụng nhiều
 * nhóm dữ liệu cùng lúc. Lưu lần khám vừa tạo visit, vừa trừ kho, vừa đổi lịch sử của
 * bệnh nhân đó; xác nhận đơn nhập kho vừa đổi đơn vừa cộng tồn. Nối tay từng chỗ là kiểu
 * việc chắc chắn sẽ quên một nhánh, mà quên thì bác sĩ thấy "vừa lưu xong vẫn hiện số cũ"
 * — đúng loại lỗi âm thầm nguy hiểm nhất với sổ sách thuốc.
 *
 * Đánh đổi: sau mỗi lần ghi, trang kế tiếp phải tải lại một lượt. Với app này thì đọc
 * nhiều hơn ghi rất nhiều nên gần như không cảm nhận được.
 */
export function cacheClear(): void {
  cache.clear();
}
