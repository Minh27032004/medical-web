package com.clinic.stock;

import com.clinic.common.ApiException;
import com.clinic.medicine.Medicine;
import com.clinic.medicine.MedicineService;
import com.clinic.medicine.MedicineUnit;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

interface StockOrderRepository extends JpaRepository<StockOrder, UUID> {

    List<StockOrder> findByDoctorIdOrderByCreatedAtDesc(UUID doctorId);

    Optional<StockOrder> findByIdAndDoctorId(UUID id, UUID doctorId);

    /** Đếm đơn trong ngày để đánh số thứ tự trong mã đơn. */
    long countByDoctorIdAndCreatedAtAfter(UUID doctorId, Instant from);
}

@Service
@RequiredArgsConstructor
public class StockOrderService {

    private final StockOrderRepository repository;
    private final MedicineService medicineService;

    // ===== DTO =====

    public record ItemInput(UUID medicineId, String unitName, BigDecimal qty) {}

    public record CreateRequest(String source, String note, List<ItemInput> items) {}

    public record ItemDto(UUID medicineId, String medicineName, String unitName, String unitLabel,
                          BigDecimal qty, String currentStockDisplay, boolean lowStock) {}

    public record OrderDto(UUID id, String code, String status, String source, String note,
                           Instant createdAt, Instant receivedAt, Instant cancelledAt,
                           List<ItemDto> items) {}

    /** Một dòng gợi ý cho "nhập nhanh": thuốc sắp hết, mặc định 1 đơn vị LỚN NHẤT. */
    public record SuggestionDto(UUID medicineId, String medicineName, String stockDisplay,
                                String baseUnitLabel, BigDecimal stockBaseQty, int threshold,
                                String defaultUnitName, String defaultUnitLabel,
                                BigDecimal defaultQty, List<UnitOptionDto> units) {}

    public record UnitOptionDto(String unitName, String label) {}

    // ===== Nhập nhanh: gợi ý từ thuốc sắp hết =====

    /**
     * Thuốc đang dưới ngưỡng cảnh báo → dựng sẵn dòng đặt hàng. Mặc định 1 đơn vị lớn nhất
     * (1 hộp thay vì 1 viên) vì nhập kho luôn nhập theo đơn vị lớn; bác sĩ chỉnh lại sau.
     */
    @Transactional(readOnly = true)
    public List<SuggestionDto> quickSuggestions(UUID doctorId) {
        return medicineService.lowStockEntities(doctorId).stream().map(m -> {
            var units = m.getUnits().stream()
                .sorted(Comparator.comparingInt(MedicineUnit::getLevelOrder))
                .toList();
            var largest = units.get(0);
            return new SuggestionDto(
                m.getId(), m.getName(), MedicineService.stockDisplay(m),
                MedicineService.UNIT_LABEL.getOrDefault(m.getBaseUnit(), m.getBaseUnit()),
                m.getStockBaseQty(), m.getLowStockThreshold(),
                largest.getUnitName(), label(largest.getUnitName()), BigDecimal.ONE,
                units.stream().map(u -> new UnitOptionDto(u.getUnitName(), label(u.getUnitName()))).toList());
        }).toList();
    }

    private static String label(String unitName) {
        return MedicineService.UNIT_LABEL.getOrDefault(unitName, unitName);
    }

    // ===== CRUD đơn =====

    @Transactional(readOnly = true)
    public List<OrderDto> list(UUID doctorId) {
        return repository.findByDoctorIdOrderByCreatedAtDesc(doctorId).stream()
            .map(o -> toDto(doctorId, o)).toList();
    }

    @Transactional(readOnly = true)
    public OrderDto get(UUID doctorId, UUID id) {
        return toDto(doctorId, findOwned(doctorId, id));
    }

    @Transactional
    public OrderDto create(UUID doctorId, CreateRequest req) {
        if (req.items() == null || req.items().isEmpty()) {
            throw ApiException.badRequest("Đơn nhập kho phải có ít nhất 1 dòng thuốc");
        }
        var order = new StockOrder();
        order.setDoctorId(doctorId);
        order.setSource("QUICK".equals(req.source()) ? "QUICK" : "MANUAL");
        order.setNote(req.note());
        order.setCode(nextCode(doctorId));

        for (var in : req.items()) {
            if (in.medicineId() == null) continue;
            if (in.qty() == null || in.qty().signum() <= 0) {
                throw ApiException.badRequest("Số lượng phải lớn hơn 0");
            }
            var m = medicineService.findOwned(doctorId, in.medicineId());
            // Ném lỗi rõ ràng nếu đơn vị không thuộc thuốc này (FE gửi sai hoặc thuốc vừa đổi đơn vị)
            MedicineService.factorOfPublic(m, in.unitName());

            var item = new StockOrderItem();
            item.setMedicineId(m.getId());
            item.setMedicineName(m.getName());
            item.setUnitName(in.unitName());
            item.setUnitLabel(label(in.unitName()));
            item.setQty(in.qty());
            order.getItems().add(item);
        }
        if (order.getItems().isEmpty()) {
            throw ApiException.badRequest("Đơn nhập kho phải có ít nhất 1 dòng thuốc");
        }
        return toDto(doctorId, repository.save(order));
    }

    /** Mã đơn dễ đọc cho file gửi nhà thuốc: NK-20260720-01. */
    private String nextCode(UUID doctorId) {
        var today = LocalDate.now(java.time.ZoneId.of("Asia/Ho_Chi_Minh"));
        var startOfDay = today.atStartOfDay(java.time.ZoneId.of("Asia/Ho_Chi_Minh")).toInstant();
        long n = repository.countByDoctorIdAndCreatedAtAfter(doctorId, startOfDay) + 1;
        return "NK-" + today.format(DateTimeFormatter.BASIC_ISO_DATE) + "-" + String.format("%02d", n);
    }

    @Transactional
    public void cancel(UUID doctorId, UUID id) {
        var o = findOwned(doctorId, id);
        requirePending(o, "hủy");
        o.setStatus(StockOrder.CANCELLED);
        o.setCancelledAt(Instant.now());
        repository.save(o);
    }

    /**
     * Xác nhận đã nhận đủ hàng → CỘNG TỒN. Chỉ chạy được đúng một lần nhờ check PENDING:
     * bấm hai lần sẽ không cộng đôi.
     */
    @Transactional
    public OrderDto receive(UUID doctorId, UUID id) {
        var o = findOwned(doctorId, id);
        requirePending(o, "xác nhận");

        for (var item : o.getItems()) {
            if (item.getMedicineId() == null) continue;
            // Khóa ghi như mọi đường đổi tồn khác — tránh mất lượt cộng khi trùng thao tác.
            var m = medicineService.findOwnedForUpdateOrNull(doctorId, item.getMedicineId());
            if (m == null) {
                throw ApiException.badRequest(
                    "Thuốc \"" + item.getMedicineName() + "\" đã bị xóa khỏi kho. "
                        + "Hủy đơn này và lập đơn mới.");
            }
            // Quy đổi theo tỷ lệ HIỆN TẠI (xem chú thích V14).
            var factor = MedicineService.factorOfPublic(m, item.getUnitName());
            medicineService.restoreStock(m, item.getQty().multiply(factor));
        }

        o.setStatus(StockOrder.RECEIVED);
        o.setReceivedAt(Instant.now());
        return toDto(doctorId, repository.save(o));
    }

    private static void requirePending(StockOrder o, String action) {
        if (!StockOrder.PENDING.equals(o.getStatus())) {
            throw ApiException.badRequest("Đơn này không còn ở trạng thái chờ nên không thể " + action);
        }
    }

    StockOrder findOwned(UUID doctorId, UUID id) {
        return repository.findByIdAndDoctorId(id, doctorId)
            .orElseThrow(() -> ApiException.notFound("Không tìm thấy đơn nhập kho"));
    }

    // ===== Mapping =====

    private OrderDto toDto(UUID doctorId, StockOrder o) {
        var items = o.getItems().stream().map(i -> {
            Medicine m = i.getMedicineId() == null ? null
                : medicineService.findOwnedOrNull(doctorId, i.getMedicineId());
            return new ItemDto(i.getMedicineId(), i.getMedicineName(), i.getUnitName(),
                i.getUnitLabel(), i.getQty(),
                m != null ? MedicineService.stockDisplay(m) : null,
                m != null && m.getStockBaseQty()
                    .compareTo(BigDecimal.valueOf(m.getLowStockThreshold())) < 0);
        }).toList();
        return new OrderDto(o.getId(), o.getCode(), o.getStatus(), o.getSource(), o.getNote(),
            o.getCreatedAt(), o.getReceivedAt(), o.getCancelledAt(), items);
    }
}
