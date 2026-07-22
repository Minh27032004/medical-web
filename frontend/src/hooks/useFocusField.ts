import { useCallback, useEffect, useRef } from "react";

/**
 * Điều hướng bàn phím cho các form nhập liều thuốc (kê đơn khám + thuốc mẫu).
 *
 * Hai form đó nhìn giống hệt nhau — cùng bộ checkbox Sáng/Trưa/Chiều/Tối, cùng ô
 * autocomplete tên thuốc. Nếu phím Enter cư xử khác nhau giữa hai màn thì trí nhớ cơ bắp
 * của bác sĩ sẽ phản chủ, nên hành vi bàn phím phải nằm chung một chỗ.
 */

/**
 * Chặn "implicit submission" của HTML: Enter trong bất kỳ <input> nào của form đều bấm hộ
 * nút submit đầu tiên. Với form một-hai ô thì tiện, nhưng form thuốc có cả chục ô và bác
 * sĩ gõ Enter liên tục để xác nhận gợi ý / tick buổi uống — mỗi lần hụt là LƯU LUÔN.
 *
 * Vẫn cho Enter đi qua với:
 *  - <textarea>: Enter là xuống dòng, vốn không submit.
 *  - <button>: Enter trên nút đang focus = click nút đó (kể cả nút Lưu) — chặn thì mất
 *    luôn khả năng thao tác bằng bàn phím, đúng thứ ta đang muốn cải thiện.
 */
export function blockImplicitSubmit(e: React.KeyboardEvent<HTMLFormElement>) {
  if (e.key !== "Enter") return;
  const el = e.target as HTMLElement;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLButtonElement) return;
  e.preventDefault();
}

/**
 * Tìm ô theo `data-focus-key` rồi focus. Trả về false nếu ô chưa có trên DOM.
 *
 * Để ngoài hook (không phụ thuộc state/props) nên không có chuyện closure cũ bị giữ lại
 * trong `useCallback` bên dưới.
 */
function applyFocus(key: string): boolean {
  const el = document.querySelector<HTMLElement>(`[data-focus-key="${key}"]`);
  if (!el) return false;
  el.focus();
  // Bôi đen sẵn để gõ số mới là đè, khỏi phải xóa giá trị cũ.
  if (el instanceof HTMLInputElement && el.type !== "checkbox") el.select();
  return true;
}

/**
 * Trả về hàm đưa con trỏ tới ô mang `data-focus-key` tương ứng.
 *
 * Vì sao không gọi thẳng element.focus(): thêm một dòng thuốc hay tick một buổi uống đều
 * làm ô cần gõ tiếp XUẤT HIỆN trong chính lần render đó — lúc gọi thì phần tử chưa nằm
 * trong DOM nên focus() rơi vào hư không. Chưa thấy ô thì ghi khóa vào ref, để effect
 * (chạy sau khi React vẽ xong) tìm lại và focus.
 *
 * Dùng ref chứ không dùng state: đây là hiệu ứng một-lần, đưa vào state sẽ kéo theo một
 * vòng render thừa và phải nhớ dọn.
 */
export function useFocusField() {
  const pendingRef = useRef<string | null>(null);

  useEffect(() => {
    const key = pendingRef.current;
    if (!key) return;
    pendingRef.current = null;
    applyFocus(key);
  });

  /** Focus ngay nếu ô đã có trên DOM, ngược lại hẹn focus sau lần render kế tiếp. */
  return useCallback((key: string) => {
    if (!applyFocus(key)) pendingRef.current = key;
  }, []);
}
