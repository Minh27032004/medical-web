import type { NextConfig } from "next";

// Hệ nội bộ — không dùng ảnh remote nữa (đã bỏ Supabase Storage).
const nextConfig: NextConfig = {
  // React Compiler: tự memo hóa component/hook — giảm re-render form/bảng lớn
  // mà không phải rải useMemo/useCallback thủ công.
  reactCompiler: true,
};

export default nextConfig;
