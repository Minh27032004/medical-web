package com.clinic.medicine;

import com.clinic.common.ApiException;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
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

    @Query("""
        select m from Medicine m
        where m.doctorId = :doctorId and m.deletedAt is null
          and m.stockBaseQty < m.lowStockThreshold
        order by m.stockBaseQty asc
        """)
    List<Medicine> findLowStock(@Param("doctorId") UUID doctorId);
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

    // ===== DTO =====

    /** Khai báo đơn vị: danh sách lớn→nhỏ, factorToNext = số đơn-vị-cấp-dưới trong 1 đơn vị này
     *  (đơn vị cuối = base, factorToNext bỏ trống). VD hộp(5) → vĩ(10) → viên. */
    public record UnitInput(String unitName, BigDecimal factorToNext) {}

    public record UpsertRequest(String name, boolean injection, Integer lowStockThreshold,
                                List<UnitInput> units) {}

    public record UnitDto(String unitName, String label, int levelOrder, BigDecimal factorToBase) {}

    public record MedicineDto(UUID id, String name, boolean injection, String baseUnit,
                              String baseUnitLabel, BigDecimal stockBaseQty, String stockDisplay,
                              int lowStockThreshold, boolean lowStock, List<UnitDto> units) {}

    public record StockEntry(String unitName, BigDecimal qty) {}

    public record AdjustRequest(List<StockEntry> entries, String reason) {}

    // ===== CRUD =====

    @Transactional(readOnly = true)
    public Page<MedicineDto> search(UUID doctorId, String q, int page, int size) {
        return repository.search(doctorId, q == null ? "" : q.trim(),
                PageRequest.of(page, Math.min(size, 100)))
            .map(MedicineService::toDto);
    }

    @Transactional(readOnly = true)
    public List<MedicineDto> lowStock(UUID doctorId) {
        return repository.findLowStock(doctorId).stream().map(MedicineService::toDto).toList();
    }

    @Transactional
    public MedicineDto create(UUID doctorId, UpsertRequest req) {
        var m = new Medicine();
        m.setDoctorId(doctorId);
        apply(m, req);
        return toDto(repository.save(m));
    }

    @Transactional
    public MedicineDto update(UUID doctorId, UUID id, UpsertRequest req) {
        var m = findOwned(doctorId, id);
        apply(m, req);
        return toDto(repository.save(m));
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
        var m = findOwned(doctorId, id);
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

    public List<Medicine> searchEntities(UUID doctorId, String q, int limit) {
        return repository.search(doctorId, q, PageRequest.of(0, limit)).getContent();
    }

    /** Trừ kho khi kê đơn — gọi trong transaction của VisitService (§6.3). Cho phép âm (D16). */
    public void deductStock(Medicine m, BigDecimal baseQty) {
        m.setStockBaseQty(m.getStockBaseQty().subtract(baseQty));
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
        m.setName(req.name().trim());
        m.setInjection(req.injection());
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

    static MedicineDto toDto(Medicine m) {
        return new MedicineDto(m.getId(), m.getName(), m.isInjection(), m.getBaseUnit(),
            UNIT_LABEL.getOrDefault(m.getBaseUnit(), m.getBaseUnit()),
            m.getStockBaseQty(), stockDisplay(m), m.getLowStockThreshold(),
            m.getStockBaseQty().compareTo(BigDecimal.valueOf(m.getLowStockThreshold())) < 0,
            m.getUnits().stream()
                .sorted(Comparator.comparingInt(MedicineUnit::getLevelOrder))
                .map(u -> new UnitDto(u.getUnitName(), UNIT_LABEL.get(u.getUnitName()),
                    u.getLevelOrder(), u.getFactorToBase()))
                .toList());
    }
}
