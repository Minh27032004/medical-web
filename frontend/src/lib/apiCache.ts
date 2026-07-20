/**
 * Cache dữ liệu GET dùng chung cả phiên (chỉ trong RAM của tab).
 *
 * Tách riêng khỏi api.ts và useApiData.ts để cả hai cùng dùng mà không import vòng.
 * KHÔNG dùng localStorage: dữ liệu bệnh nhân không nên nằm lại trên máy sau khi đóng tab.
 */
const cache = new Map<string, unknown>();

export function cacheGet<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined;
}

export function cacheHas(key: string): boolean {
  return cache.has(key);
}

export function cacheSet(key: string, value: unknown): void {
  cache.set(key, value);
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
