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
