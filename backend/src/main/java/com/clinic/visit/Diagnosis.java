package com.clinic.visit;

/** Cặp mã + tên ICD-10 (snapshot). Dùng cho danh sách chẩn đoán phụ lưu jsonb trên visits. */
public record Diagnosis(String code, String name) {}
