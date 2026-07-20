export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface Me {
  id: string;
  role: "ADMIN" | "DOCTOR";
  username: string;
  fullName: string | null;
  phone: string | null;
  clinicName: string | null;
}

export interface DoctorRow {
  id: string;
  username: string | null;
  email: string | null;
  fullName: string;
  phone: string | null;
  clinicName: string | null;
  blocked: boolean;
  createdAt: string;
}

export interface Patient {
  id: string;
  fullName: string;
  phone: string | null;
  gender: "male" | "female" | "other" | null;
  /** Tuổi — tùy chọn, null = chưa ghi (V13). */
  age: number | null;
  /** Địa chỉ — dữ liệu cũ, đã bỏ khỏi form nhập (thay bằng tuổi). */
  address: string | null;
  hasDrugAllergy: boolean;
  drugAllergyNote: string | null;
  hasChronicCondition: boolean;
  chronicConditionNote: string | null;
  createdAt: string;
}

export interface MedicineUnitDto {
  unitName: string;
  label: string;
  levelOrder: number;
  factorToBase: number;
}

export interface Medicine {
  id: string;
  name: string;
  injection: boolean;
  infusion: boolean;
  baseUnit: string;
  baseUnitLabel: string;
  stockBaseQty: number;
  stockDisplay: string;
  lowStockThreshold: number;
  lowStock: boolean;
  units: MedicineUnitDto[];
  imagePath: string | null;
  imageUrl: string | null;
}

export interface Template {
  id: string;
  name: string;
  medicineId: string | null;
  medicineName: string | null;
  stockDisplay: string | null;
  injection: boolean;
  infusion: boolean;
  doseMorning: number;
  doseNoon: number;
  doseAfternoon: number;
  doseEvening: number;
  usageNote: string | null;
  numDays: number | null;
}

export interface Suggestion {
  type: "TEMPLATE" | "MEDICINE";
  templateId: string | null;
  medicineId: string | null;
  name: string;
  baseUnit: string | null;
  baseUnitLabel: string | null;
  stockDisplay: string | null;
  injection: boolean;
  infusion: boolean;
  doseMorning: number | null;
  doseNoon: number | null;
  doseAfternoon: number | null;
  doseEvening: number | null;
  usageNote: string | null;
  numDays: number | null;
}

export interface Icd10 {
  code: string;
  name: string;
}

/** Cặp mã + tên ICD-10 (dùng cho chẩn đoán phụ). */
export interface Diagnosis {
  code: string;
  name: string;
}

export interface VisitRow {
  id: string;
  visitDate: string;
  patientId: string;
  patientName: string;
  diagnosisCode: string;
  diagnosisName: string;
  hasInjection: boolean;
}

export interface RxItem {
  medicineId: string | null;
  medicineName: string;
  baseUnit: string;
  baseUnitLabel: string;
  doseMorning: number;
  doseNoon: number;
  doseAfternoon: number;
  doseEvening: number;
  specialDoseText: string | null;
  usageNote: string | null;
  numDays: number | null;
  totalQuantityBase: number;
  injection: boolean;
  infusion: boolean;
}

export interface VisitDetail {
  id: string;
  visitDate: string;
  diagnosisCode: string;
  diagnosisName: string;
  secondaryDiagnoses: Diagnosis[];
  note: string | null;
  patient: Patient;
  doctor: { fullName: string | null; clinicName: string | null; phone: string | null };
  prescriptionId: string | null;
  printedAt: string | null;
  items: RxItem[];
}

export interface ChatResponse {
  intent: string;
  title: string | null;
  rows: Record<string, unknown>[];
  message: string | null;
}

/** Một lượt hỏi–đáp cũ (V9) — nạp khi mở chat để có lại ngữ cảnh hiển thị. */
export interface ChatHistoryItem {
  question: string;
  intent: string;
  answerSummary: string | null;
  createdAt: string;
}

export const GENDER_LABEL: Record<string, string> = {
  male: "Nam",
  female: "Nữ",
  other: "Khác",
};

/** Đơn vị chuẩn theo đặc tả §6.1 — lớn → nhỏ; ống dùng riêng cho thuốc tiêm. */
export const UNIT_OPTIONS = [
  { value: "chai", label: "chai" },
  { value: "hop", label: "hộp" },
  { value: "vi", label: "vĩ" },
  { value: "vien", label: "viên" },
  { value: "goi", label: "gói" },
];

export const UNIT_LABEL: Record<string, string> = {
  chai: "chai", hop: "hộp", vi: "vĩ", vien: "viên", goi: "gói", ong: "ống",
};

/* ===== Đơn nhập kho (V14) ===== */

export type StockOrderStatus = "PENDING" | "RECEIVED" | "CANCELLED";

export interface StockOrderItem {
  medicineId: string | null;
  medicineName: string;
  unitName: string;
  unitLabel: string;
  qty: number;
  currentStockDisplay: string | null;
  lowStock: boolean;
  imageUrl: string | null;
}

export interface StockOrder {
  id: string;
  code: string;
  status: StockOrderStatus;
  source: "QUICK" | "MANUAL";
  note: string | null;
  createdAt: string;
  receivedAt: string | null;
  cancelledAt: string | null;
  items: StockOrderItem[];
}

/** Một dòng gợi ý "nhập nhanh" — thuốc đang dưới ngưỡng cảnh báo. */
export interface StockSuggestion {
  medicineId: string;
  medicineName: string;
  stockDisplay: string;
  baseUnitLabel: string;
  stockBaseQty: number;
  threshold: number;
  defaultUnitName: string;
  defaultUnitLabel: string;
  defaultQty: number;
  units: { unitName: string; label: string }[];
}

export const STOCK_ORDER_STATUS_LABEL: Record<StockOrderStatus, string> = {
  PENDING: "Chờ xử lý",
  RECEIVED: "Đã nhập kho",
  CANCELLED: "Đã hủy",
};
