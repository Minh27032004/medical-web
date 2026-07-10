/**
 * Giỏ hàng cho Customer (khách vãng lai) — lưu localStorage, backend không biết (D9).
 * Khi đăng nhập: gọi mergeToServer() để đẩy vào giỏ DB rồi xóa local.
 */
import { api } from "./api";

export interface LocalCartItem {
  medicineId: string;
  quantity: number;
}

const KEY = "clinic_cart";

function isBrowser() {
  return typeof window !== "undefined";
}

export function getLocalCart(): LocalCartItem[] {
  if (!isBrowser()) return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function addToLocalCart(medicineId: string, quantity = 1) {
  const cart = getLocalCart();
  const existing = cart.find((i) => i.medicineId === medicineId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({ medicineId, quantity });
  }
  localStorage.setItem(KEY, JSON.stringify(cart));
}

export function removeFromLocalCart(medicineId: string) {
  const cart = getLocalCart().filter((i) => i.medicineId !== medicineId);
  localStorage.setItem(KEY, JSON.stringify(cart));
}

export function clearLocalCart() {
  localStorage.removeItem(KEY);
}

/** Gọi ngay sau khi đăng nhập thành công. */
export async function mergeToServer() {
  const items = getLocalCart();
  if (items.length === 0) return;
  await api("/api/me/cart/merge", {
    method: "POST",
    body: JSON.stringify({ items }),
  });
  clearLocalCart();
}
