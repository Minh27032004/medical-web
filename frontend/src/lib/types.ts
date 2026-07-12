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
  username: string;
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
  baseUnit: string;
  baseUnitLabel: string;
  stockBaseQty: number;
  stockDisplay: string;
  lowStockThreshold: number;
  lowStock: boolean;
  units: MedicineUnitDto[];
}

export interface Template {
  id: string;
  name: string;
  medicineId: string | null;
  medicineName: string | null;
  stockDisplay: string | null;
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
}

export interface VisitDetail {
  id: string;
  visitDate: string;
  diagnosisCode: string;
  diagnosisName: string;
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
