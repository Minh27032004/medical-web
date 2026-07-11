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

export interface Slot {
  start: string;
  end: string;
  available: boolean;
}

export type AppointmentStatus = "BOOKED" | "CONFIRMED" | "DONE" | "CANCELLED";

export interface AppointmentDocument {
  id: string;
  url: string;
}

export interface Appointment {
  id: string;
  profileId?: string; // chỉ Doctor — để liên kết khi tạo hồ sơ bệnh nhân
  slotStart: string;
  slotEnd: string;
  status: AppointmentStatus;
  note: string | null;
  documents: AppointmentDocument[];
  patientName?: string | null; // chỉ Doctor
  patientPhone?: string | null;
}

export interface AvailabilityRow {
  weekday: number; // 0 = Chủ nhật
  startTime: string; // "08:00:00"
  endTime: string;
  slotMinutes: number;
}

export const APPT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  BOOKED: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  DONE: "Đã khám",
  CANCELLED: "Đã hủy",
};

export const APPT_STATUS_COLOR: Record<AppointmentStatus, string> = {
  BOOKED: "bg-amber-50 text-amber-700",
  CONFIRMED: "bg-blue-50 text-blue-700",
  DONE: "bg-blue-50 text-blue-700",
  CANCELLED: "bg-gray-100 text-gray-500",
};

export interface Patient {
  id: string;
  fullName: string;
  phone: string | null;
  age: number | null;
  photoUrl: string | null;
  note: string | null;
  profileId: string | null;
  createdAt: string;
}

export interface PrescriptionItem {
  medicineName: string;
  quantity: number;
  dosage: string | null;
  costPrice: number | null; // null với Patient
  salePrice: number;
}

export interface PrescriptionImage {
  id: string;
  kind: "XRAY" | "ECG" | "OTHER";
  url: string;
}

export interface Prescription {
  id: string;
  patientId: string;
  patientName: string | null;
  symptoms: string | null;
  diagnosis: string | null;
  examFee: number;
  medicineTotal: number;
  costTotal: number | null; // null với Patient
  createdAt: string;
  items: PrescriptionItem[];
  images: PrescriptionImage[];
}

export const IMAGE_KIND_LABEL: Record<string, string> = {
  XRAY: "X-quang",
  ECG: "Điện tim",
  OTHER: "Khác",
};

export const WEEKDAY_LABEL = [
  "Chủ nhật",
  "Thứ 2",
  "Thứ 3",
  "Thứ 4",
  "Thứ 5",
  "Thứ 6",
  "Thứ 7",
];

export const ORDER_STATUS_COLOR: Record<OrderStatus, string> = {
  PENDING: "bg-amber-50 text-amber-700",
  CONFIRMED: "bg-blue-50 text-blue-700",
  READY: "bg-purple-50 text-purple-700",
  COMPLETED: "bg-blue-50 text-blue-700",
  CANCELLED: "bg-gray-100 text-gray-500",
};
