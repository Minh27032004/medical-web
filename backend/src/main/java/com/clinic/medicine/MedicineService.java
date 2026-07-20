package com.clinic.medicine;

import com.clinic.common.ApiException;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import jakarta.persistence.LockModeType;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

interface MedicineRepository extends JpaRepository<Medicine, UUID> {

    @Query("""
        select m from Medicine m
        where m.doctorId = :doctorId and m.deletedAt is null
          and lower(m.name) like lower(concat('%', :q, '%'))
        order by m.name
        """)
    Page<Medicine> search(@Param("doctorId") UUID doctorId, @Param("q") String q, Pageable pageable);

    Optional<Medicine> findByIdAndDoctorIdAndDeletedAtIsNull(UUID id, UUID doctorId);

    /**
     * Như trên nhưng SELECT ... FOR UPDATE — BẮT BUỘC dùng cho mọi đường THAY ĐỔI TỒN KHO
     * (kê đơn, nhập/chỉnh tay, hoàn kho khi xóa lần khám).
     *
     * Không có khóa này thì hai transaction cùng trừ một thuốc sẽ "lost update": cả hai đọc
     * tồn 100, cả hai ghi 90 — mất một lần trừ mà không có lỗi nào báo ra.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
        select m from Medicine m
        where m.id = :id and m.doctorId = :doctorId and m.deletedAt is null
        """)
    Optional<Medicine> findOwnedForUpdate(@Param("id") UUID id, @Param("doctorId") UUID doctorId);

    List<Medicine> findByIdInAndDoctorIdAndDeletedAtIsNull(Collection<UUID> ids, UUID doctorId);

    @Query("""
        select m from Medicine m
        where m.doctorId = :doctorId and m.deletedAt is null
          and m.stockBaseQty < m.lowStockThreshold
        order by m.stockBaseQty asc
        """)
    List<Medicine> findLowStock(@Param("doctorId") UUID doctorId);

    @Query("""
        select m from Medicine m
        where m.doctorId = :doctorId and m.deletedAt is null
        order by m.stockBaseQty asc
        """)
    List<Medicine> findByStockAsc(@Param("doctorId") UUID doctorId, Pageable pageable);
}

@Service
@RequiredArgsConstructor
public class MedicineService {

    /** Thứ tự lớn→nhỏ theo đặc tả §6.1. Ống dùng riêng cho thuốc tiêm. */
    public static final Map<String, Integer> LEVEL_ORDER = Map.of(
        "chai", 1, "hop", 2, "vi", 3, "vien", 4, "goi", 5, "ong", 9);

    public static final Map<String, String> UNIT_LABEL = Map.of(
        "chai", "chai", "hop", "hộp", "vi", "vĩ", "vien", "viên", "goi", "gói", "ong", "ống");

    private final MedicineRepository repository;
    private final com.clinic.storage.SupabaseStorageService storage;

    // ===== DTO =====

    /** Khai báo đơn vị: danh sách lớn→nhỏ, factorToNext = số đơn-vị-cấp-dưới trong 1 đơn vị này
     *  (đơn vị cuối = base, factorToNext bỏ trống). VD hộp(5) → vĩ(10) → viên. */
    public record UnitInput(String unitName, BigDecimal factorToNext) {}

    public record UpsertRequest(String name, boolean injection, boolean infusion,
                                Integer lowStockThreshold,
                                List<UnitInput> units, String imagePath,
                                // Tồn ban đầu: số lượng theo initialStockUnit (quy về base khi lưu)
                                String initialStockUnit, BigDecimal initialStockQty,
                                // Chỉ dùng khi CẬP NHẬT: true = ghi đè tồn bằng initialStock*
                                // (bác sĩ đã đổi cấu trúc đơn vị nên phải nhập lại tồn từ đầu).
                                // false/null = giữ nguyên tồn hiện có.
                                Boolean resetStock) {}

    public record UnitDto(String unitName, String label, int levelOrder, BigDecimal factorToBase) {}

    public record MedicineDto(UUID id, String name, boolean injection, boolean infusion,
                              String baseUnit,
                              String baseUnitLabel, BigDecimal stockBaseQty, String stockDisplay,
                              int lowStockThreshold, boolean lowStock, List<UnitDto> units,
                              String imagePath, String imageUrl) {}

    public record StockEntry(String unitName, BigDecimal qty) {}

    public record AdjustRequest(List<StockEntry> entries, String reason) {}

    // ===== CRUD =====

    /**
     * Trần 500: trang kho thuốc tải MỘT lần rồi lọc/phân trang phía client (chip uống/tiêm/
     * truyền dịch chạy client-side), nên trần thấp sẽ LÀM MẤT thuốc khỏi giao diện chứ không
     * chỉ cắt trang. Danh mục thuốc của một phòng khám thực tế nằm dưới ngưỡng này rất xa.
     */
    private static final int MAX_PAGE_SIZE = 500;

    @Transactional(readOnly = true)
    public Page<MedicineDto> search(UUID doctorId, String q, int page, int size) {
        return repository.search(doctorId, q == null ? "" : q.trim(),
                PageRequest.of(page, Math.min(size, MAX_PAGE_SIZE)))
            .map(this::toDto);
    }

    @Transactional(readOnly = true)
    public List<MedicineDto> lowStock(UUID doctorId) {
        return repository.findLowStock(doctorId).stream().map(this::toDto).toList();
    }

    /** Tóm tắt thuốc tồn thấp nhất — cho trợ lý chat (LOWEST_STOCK). Tính display TRONG transaction. */
    public record LowestStockInfo(String name, String stockDisplay, BigDecimal stockBaseQty,
                                  String baseUnitLabel, int threshold, boolean below) {}

    @Transactional(readOnly = true)
    public Optional<LowestStockInfo> lowestStock(UUID doctorId) {
        var list = repository.findByStockAsc(doctorId, PageRequest.of(0, 1));
        if (list.isEmpty()) return Optional.empty();
        var m = list.get(0);
        return Optional.of(new LowestStockInfo(m.getName(), stockDisplay(m), m.getStockBaseQty(),
            UNIT_LABEL.getOrDefault(m.getBaseUnit(), m.getBaseUnit()), m.getLowStockThreshold(),
            m.getStockBaseQty().compareTo(BigDecimal.valueOf(m.getLowStockThreshold())) < 0));
    }

    @Transactional
    public MedicineDto create(UUID doctorId, UpsertRequest req) {
        var m = new Medicine();
        m.setDoctorId(doctorId);
        apply(m, req);
        applyInitialStock(m, req);
        return toDto(repository.save(m));
    }

    @Transactional
    public MedicineDto update(UUID doctorId, UUID id, UpsertRequest req) {
        var m = findOwned(doctorId, id);
        // Xóa đơn vị cũ rồi ĐẨY DELETE xuống DB TRƯỚC khi apply() thêm đơn vị mới.
        // Hibernate xếp INSERT trước orphan-DELETE trong cùng một flush, nên nếu không
        // flush ở đây thì việc giữ lại cùng tên đơn vị sẽ đụng unique(medicine_id, unit_name).
        m.getUnits().clear();
        repository.flush();
        apply(m, req);
        // Đổi cấu trúc đơn vị (hoặc đổi loại thuốc) làm tồn cũ vô nghĩa vì base_unit đã khác
        // → frontend bắt nhập lại tồn và gửi resetStock=true để ghi đè (D16: tồn theo base).
        if (Boolean.TRUE.equals(req.resetStock())) {
            m.setStockBaseQty(BigDecimal.ZERO);
            applyInitialStock(m, req);
        }
        return toDto(repository.save(m));
    }

    /** Tồn ban đầu: quy về đơn vị nhỏ nhất qua factor (người dùng nhập theo đơn vị lớn nhất). */
    private void applyInitialStock(Medicine m, UpsertRequest req) {
        if (req.initialStockQty() == null || req.initialStockQty().signum() <= 0) return;
        var unit = req.initialStockUnit() != null && !req.initialStockUnit().isBlank()
            ? req.initialStockUnit() : m.getBaseUnit();
        m.setStockBaseQty(req.initialStockQty().multiply(factorOf(m, unit)));
    }

    @Transactional
    public void softDelete(UUID doctorId, UUID id) {
        var m = findOwned(doctorId, id);
        m.setDeletedAt(Instant.now());
        repository.save(m);
    }

    /** Nhập kho / chỉnh tay: entries theo đơn vị bất kỳ (qty âm = trừ), quy hết về base (§6.2). */
    @Transactional
    public MedicineDto adjustStock(UUID doctorId, UUID id, AdjustRequest req) {
        var m = findOwnedForUpdate(doctorId, id); // khóa: tránh mất lượt nhập khi 2 tab cùng lưu
        if (req.entries() == null || req.entries().isEmpty()) {
            throw ApiException.badRequest("Chưa nhập số lượng");
        }
        var delta = BigDecimal.ZERO;
        for (var e : req.entries()) {
            if (e.qty() == null || e.qty().signum() == 0) continue;
            delta = delta.add(e.qty().multiply(factorOf(m, e.unitName())));
        }
        m.setStockBaseQty(m.getStockBaseQty().add(delta));
        return toDto(repository.save(m));
    }

    public Medicine findOwned(UUID doctorId, UUID id) {
        return repository.findByIdAndDoctorIdAndDeletedAtIsNull(id, doctorId)
            .orElseThrow(() -> ApiException.notFound("Không tìm thấy thuốc trong kho"));
    }

    public Medicine findOwnedOrNull(UUID doctorId, UUID id) {
        return repository.findByIdAndDoctorIdAndDeletedAtIsNull(id, doctorId).orElse(null);
    }

    /** Nạp thuốc KÈM KHÓA GHI — dùng khi sắp trừ/cộng tồn. Phải nằm trong transaction. */
    public Medicine findOwnedForUpdate(UUID doctorId, UUID id) {
        return repository.findOwnedForUpdate(id, doctorId)
            .orElseThrow(() -> ApiException.notFound("Không tìm thấy thuốc trong kho"));
    }

    /** Như trên nhưng trả null thay vì ném lỗi (thuốc có thể đã bị xóa khỏi kho). */
    public Medicine findOwnedForUpdateOrNull(UUID doctorId, UUID id) {
        return repository.findOwnedForUpdate(id, doctorId).orElse(null);
    }

    /** Nạp NHIỀU thuốc theo id trong 1 query — tránh N+1 khi map danh sách thuốc mẫu (§5.4). */
    @Transactional(readOnly = true)
    public Map<UUID, Medicine> mapByIds(UUID doctorId, Collection<UUID> ids) {
        if (ids == null || ids.isEmpty()) return Map.of();
        return repository.findByIdInAndDoctorIdAndDeletedAtIsNull(ids, doctorId).stream()
            .collect(Collectors.toMap(Medicine::getId, m -> m));
    }

    public List<Medicine> searchEntities(UUID doctorId, String q, int limit) {
        return repository.search(doctorId, q, PageRequest.of(0, limit)).getContent();
    }

    /** Trừ kho khi kê đơn — gọi trong transaction của VisitService (§6.3). Cho phép âm (D16). */
    public void deductStock(Medicine m, BigDecimal baseQty) {
        m.setStockBaseQty(m.getStockBaseQty().subtract(baseQty));
        repository.save(m);
    }

    /** Hoàn kho khi XÓA lần khám (V12) — cộng ngược đúng số đã trừ lúc kê đơn. */
    public void restoreStock(Medicine m, BigDecimal baseQty) {
        m.setStockBaseQty(m.getStockBaseQty().add(baseQty));
        repository.save(m);
    }

    // ===== Logic đơn vị =====

    static BigDecimal factorOf(Medicine m, String unitName) {
        return m.getUnits().stream()
            .filter(u -> u.getUnitName().equals(unitName))
            .findFirst()
            .map(MedicineUnit::getFactorToBase)
            .orElseThrow(() -> ApiException.badRequest(
                "Thuốc này không có đơn vị '" + UNIT_LABEL.getOrDefault(unitName, unitName) + "'"));
    }

    private void apply(Medicine m, UpsertRequest req) {
        if (req.name() == null || req.name().isBlank()) {
            throw ApiException.badRequest("Thiếu tên thuốc");
        }
        if (req.injection() && req.infusion()) {
            throw ApiException.badRequest("Thuốc chỉ thuộc MỘT loại: tiêm hoặc truyền dịch");
        }
        m.setName(req.name().trim());
        m.setInjection(req.injection());
        m.setInfusion(req.infusion());
        m.setImagePath(req.imagePath());
        if (req.lowStockThreshold() != null && req.lowStockThreshold() >= 0) {
            m.setLowStockThreshold(req.lowStockThreshold());
        }

        m.getUnits().clear();
        if (req.injection()) {
            // Thuốc tiêm: duy nhất đơn vị ống, không quy đổi (§6.1, §6.3)
            m.setBaseUnit("ong");
            m.getUnits().add(makeUnit("ong", BigDecimal.ONE));
            return;
        }
        if (req.infusion()) {
            // Truyền dịch: duy nhất đơn vị chai, không quy đổi (V11)
            m.setBaseUnit("chai");
            m.getUnits().add(makeUnit("chai", BigDecimal.ONE));
            return;
        }

        var inputs = req.units();
        if (inputs == null || inputs.isEmpty()) {
            throw ApiException.badRequest("Chọn ít nhất 1 đơn vị cho thuốc");
        }
        // validate: đơn vị hợp lệ, không trùng, đúng thứ tự lớn→nhỏ, không có 'ong'
        var seen = new ArrayList<Integer>();
        for (var in : inputs) {
            var level = LEVEL_ORDER.get(in.unitName());
            if (level == null || level == 9) {
                throw ApiException.badRequest("Đơn vị không hợp lệ: " + in.unitName());
            }
            if (!seen.isEmpty() && level <= seen.get(seen.size() - 1)) {
                throw ApiException.badRequest("Đơn vị phải theo thứ tự lớn → nhỏ, không trùng");
            }
            seen.add(level);
        }
        // tính factor_to_base từ dưới lên: cuối = base (1); trên = factorToNext × factor(dưới)
        var factors = new BigDecimal[inputs.size()];
        factors[inputs.size() - 1] = BigDecimal.ONE;
        for (int i = inputs.size() - 2; i >= 0; i--) {
            var f = inputs.get(i).factorToNext();
            if (f == null || f.signum() <= 0) {
                throw ApiException.badRequest("Thiếu tỷ lệ quy đổi cho đơn vị "
                    + UNIT_LABEL.get(inputs.get(i).unitName()));
            }
            factors[i] = f.multiply(factors[i + 1]);
        }
        m.setBaseUnit(inputs.get(inputs.size() - 1).unitName());
        for (int i = 0; i < inputs.size(); i++) {
            m.getUnits().add(makeUnit(inputs.get(i).unitName(), factors[i]));
        }
    }

    private static MedicineUnit makeUnit(String unitName, BigDecimal factor) {
        var u = new MedicineUnit();
        u.setUnitName(unitName);
        u.setLevelOrder(LEVEL_ORDER.get(unitName));
        u.setFactorToBase(factor);
        return u;
    }

    /** Hiển thị tồn quy ngược lớn→nhỏ: 210 viên (hộp=50, vĩ=10) → "4 hộp 2 vĩ" (§6.2). */
    public static String stockDisplay(Medicine m) {
        var stock = m.getStockBaseQty();
        var baseLabel = UNIT_LABEL.getOrDefault(m.getBaseUnit(), m.getBaseUnit());
        if (stock.signum() < 0) {
            return stock.stripTrailingZeros().toPlainString() + " " + baseLabel + " (ÂM — cần đối soát)";
        }
        var sorted = m.getUnits().stream()
            .sorted(Comparator.comparingInt(MedicineUnit::getLevelOrder))
            .toList();
        var parts = new ArrayList<String>();
        var remaining = stock;
        for (var u : sorted) {
            var factor = u.getFactorToBase();
            if (factor.compareTo(BigDecimal.ONE) == 0) break; // tới base thì dừng, xử lý sau
            var count = remaining.divideToIntegralValue(factor);
            if (count.signum() > 0) {
                parts.add(count.toBigInteger() + " " + UNIT_LABEL.get(u.getUnitName()));
                remaining = remaining.subtract(count.multiply(factor));
            }
        }
        if (remaining.signum() > 0 || parts.isEmpty()) {
            parts.add(remaining.stripTrailingZeros().toPlainString() + " " + baseLabel);
        }
        return String.join(" ", parts);
    }

    MedicineDto toDto(Medicine m) {
        return new MedicineDto(m.getId(), m.getName(), m.isInjection(), m.isInfusion(),
            m.getBaseUnit(),
            UNIT_LABEL.getOrDefault(m.getBaseUnit(), m.getBaseUnit()),
            m.getStockBaseQty(), stockDisplay(m), m.getLowStockThreshold(),
            m.getStockBaseQty().compareTo(BigDecimal.valueOf(m.getLowStockThreshold())) < 0,
            m.getUnits().stream()
                .sorted(Comparator.comparingInt(MedicineUnit::getLevelOrder))
                .map(u -> new UnitDto(u.getUnitName(), UNIT_LABEL.get(u.getUnitName()),
                    u.getLevelOrder(), u.getFactorToBase()))
                .toList(),
            m.getImagePath(), storage.publicUrl(m.getImagePath()));
    }
}
