package com.clinic.storage;

import java.awt.Image;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import javax.imageio.ImageIO;
import lombok.extern.slf4j.Slf4j;

/**
 * Thu nhỏ ảnh thuốc trước khi đẩy lên Storage.
 *
 * Ảnh chỉ hiển thị ở 40–80px trong bảng kho và 44px ở đơn nhập kho, nên cạnh dài 640px là
 * quá đủ (còn dư cho màn hình 2x và cho lúc xem ảnh to hơn sau này). Ảnh gốc từ điện thoại
 * thường 3000px+ / vài MB.
 *
 * Dùng ImageIO có sẵn trong JDK, không thêm thư viện. Có bất kỳ trục trặc nào (định dạng lạ,
 * ảnh hỏng) thì TRẢ LẠI ẢNH GỐC — nén ảnh là tối ưu, không đáng để làm hỏng việc upload.
 */
@Slf4j
final class ImageShrinker {

    private static final int MAX_EDGE = 640;

    private ImageShrinker() {}

    static byte[] shrink(byte[] original, String ext) {
        // WebP: JDK không có encoder, ghi ra định dạng khác sẽ khiến phần mở rộng và
        // Content-Type lệch với nội dung thật. WebP vốn đã nhỏ — để nguyên.
        if ("webp".equals(ext)) return original;
        try {
            var src = ImageIO.read(new ByteArrayInputStream(original));
            if (src == null) return original; // không đọc được → giữ nguyên

            int w = src.getWidth();
            int h = src.getHeight();
            if (w <= MAX_EDGE && h <= MAX_EDGE) return original; // đã nhỏ sẵn

            double scale = (double) MAX_EDGE / Math.max(w, h);
            int nw = Math.max(1, (int) Math.round(w * scale));
            int nh = Math.max(1, (int) Math.round(h * scale));

            // PNG/WebP có thể có nền trong suốt → giữ kênh alpha; JPEG thì không hỗ trợ alpha.
            boolean keepAlpha = !"jpg".equals(ext);
            var out = new BufferedImage(nw, nh,
                keepAlpha ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB);
            var g = out.createGraphics();
            g.drawImage(src.getScaledInstance(nw, nh, Image.SCALE_SMOOTH), 0, 0, null);
            g.dispose();

            // Ghi lại ĐÚNG định dạng ban đầu để khớp phần mở rộng file và Content-Type.
            var buf = new ByteArrayOutputStream();
            if (!ImageIO.write(out, ext, buf)) return original;

            var result = buf.toByteArray();
            log.info("Nén ảnh thuốc: {}x{} {}KB → {}x{} {}KB",
                w, h, original.length / 1024, nw, nh, result.length / 1024);
            // Hiếm nhưng có thật: PNG ảnh chụp sau khi re-encode có thể to hơn bản gốc.
            return result.length < original.length ? result : original;
        } catch (IOException | RuntimeException e) {
            log.warn("Không nén được ảnh, dùng ảnh gốc", e);
            return original;
        }
    }
}
