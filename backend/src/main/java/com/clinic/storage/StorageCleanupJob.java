package com.clinic.storage;

import java.time.Duration;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Dọn ảnh MỒ CÔI trong bucket — file không còn thuốc nào trỏ tới.
 *
 * Rác sinh ra từ hai đường: bác sĩ đổi ảnh của một thuốc (ảnh cũ ở lại), và upload xong
 * rồi bỏ dở không lưu thuốc. Không dọn thì bucket chỉ có tăng.
 *
 * HAI CHỐT AN TOÀN:
 *  1. "Đang dùng" tính CẢ thuốc đã xóa mềm. Xóa mềm là có thể khôi phục (D12), nên xóa
 *     ảnh của nó đi là biến thao tác khôi phục được thành mất mát vĩnh viễn.
 *  2. Chỉ đụng file cũ hơn {@link #MIN_AGE}. Ảnh được upload TRƯỚC khi bấm lưu thuốc, nên
 *     trong lúc bác sĩ còn đang điền form thì file đó chưa ai tham chiếu — dọn ngay là
 *     xóa mất ảnh ngay dưới tay người đang dùng.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class StorageCleanupJob {

    /** Đủ dài để không đụng ảnh của form đang mở dở, đủ ngắn để rác không tích lâu. */
    private static final Duration MIN_AGE = Duration.ofDays(7);

    private final SupabaseStorageService storage;
    private final JdbcTemplate jdbc;

    /** 3h sáng Chủ nhật — giờ phòng khám không hoạt động. */
    @Scheduled(cron = "0 0 3 * * SUN", zone = "Asia/Ho_Chi_Minh")
    public void scheduled() {
        var report = run(false);
        log.info("Dọn ảnh mồ côi: {}", report);
    }

    public record Report(int inBucket, int referenced, int orphans, int tooNew, int deleted) {
        @Override
        public String toString() {
            return inBucket + " file trong bucket, " + referenced + " đang dùng, "
                + orphans + " mồ côi (" + tooNew + " còn mới nên bỏ qua), đã xóa " + deleted;
        }
    }

    /** dryRun = true: chỉ đếm và log, không xóa gì. */
    public Report run(boolean dryRun) {
        List<SupabaseStorageService.StoredObject> objects;
        try {
            objects = storage.listMedicineImages();
        } catch (RuntimeException e) {
            log.warn("Không liệt kê được bucket, bỏ lượt dọn này", e);
            return new Report(0, 0, 0, 0, 0);
        }

        // KHÔNG lọc deleted_at: thuốc xóa mềm vẫn giữ quyền với ảnh của nó (chốt an toàn 1).
        var referenced = new HashSet<String>();
        for (var path : jdbc.queryForList(
            "select image_path from medicines where image_path is not null", String.class)) {
            referenced.add(SupabaseStorageService.fileNameOf(path));
        }

        var cutoff = Instant.now().minus(MIN_AGE);
        int orphans = 0;
        int tooNew = 0;
        int deleted = 0;

        for (var obj : objects) {
            if (referenced.contains(obj.name())) continue;
            orphans++;
            if (obj.createdAt().isAfter(cutoff)) { // chốt an toàn 2
                tooNew++;
                continue;
            }
            if (dryRun) continue;
            if (storage.delete(storage.pathOf(obj.name()))) {
                deleted++;
                log.info("Đã xóa ảnh mồ côi: {}", obj.name());
            }
        }
        return new Report(objects.size(), referenced.size(), orphans, tooNew, deleted);
    }
}
