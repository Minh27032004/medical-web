import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // React Compiler: tự memo hóa component/hook — giảm re-render form/bảng lớn
  // mà không phải rải useMemo/useCallback thủ công.
  reactCompiler: true,

  images: {
    /**
     * Ảnh thuốc nằm trên Supabase Storage (bucket public medicine-images).
     * Khai báo host ở đây để BỎ được `unoptimized`: trước đây mỗi ô ảnh 40×40 trong bảng
     * kho thuốc tải nguyên file gốc (upload cho phép tới 5MB) — 10 dòng là có thể ngốn
     * hàng chục MB chỉ để vẽ vài chục pixel. Có optimizer thì Next phục vụ đúng cỡ,
     * định dạng AVIF/WebP, và cache lại ở CDN.
     */
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cgnwrbbrtqyqmlpyrudx.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
    // Ảnh thuốc chỉ hiện cỡ nhỏ: 40px trong bảng, 80px trong form, 44px ở đơn nhập kho.
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    minimumCacheTTL: 60 * 60 * 24 * 30, // ảnh thuốc gần như không đổi → cache 30 ngày
  },
};

export default nextConfig;
