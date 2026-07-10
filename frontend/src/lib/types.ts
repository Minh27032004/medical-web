export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface MedicinePublic {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  salePrice: number;
  expiryDate: string | null;
}

export interface MedicineDoctor extends MedicinePublic {
  imagePath: string | null;
  costPrice: number;
  inStock: boolean;
}

export interface MedicineSuggestion {
  id: string;
  name: string;
  imageUrl: string | null;
  salePrice: number;
}

export interface Profile {
  id: string;
  role: "PATIENT" | "DOCTOR";
  fullName: string | null;
  phone: string | null;
}

export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "READY"
  | "COMPLETED"
  | "CANCELLED";

export interface OrderItem {
  medicineName: string;
  quantity: number;
  salePrice: number;
  costPrice?: number; // chỉ có ở response cho Doctor
}

export interface Order {
  id: string;
  pickupCode: string;
  status: OrderStatus;
  totalAmount: number;
  createdAt: string;
  items: OrderItem[];
  buyerName?: string | null; // chỉ Doctor
  buyerPhone?: string | null;
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  READY: "Chờ đến lấy",
  COMPLETED: "Hoàn tất",
  CANCELLED: "Đã hủy",
};

export const ORDER_STATUS_COLOR: Record<OrderStatus, string> = {
  PENDING: "bg-amber-50 text-amber-700",
  CONFIRMED: "bg-blue-50 text-blue-700",
  READY: "bg-purple-50 text-purple-700",
  COMPLETED: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-gray-100 text-gray-500",
};
