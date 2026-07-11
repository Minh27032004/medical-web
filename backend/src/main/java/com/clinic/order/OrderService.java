package com.clinic.order;

import com.clinic.auth.ProfileRepository;
import com.clinic.cart.CartService;
import com.clinic.common.ApiException;
import com.clinic.medicine.Medicine;
import com.clinic.medicine.MedicineRepository;
import com.clinic.order.OrderDtos.CreateRequest;
import com.clinic.order.OrderDtos.DoctorItem;
import com.clinic.order.OrderDtos.DoctorOrder;
import com.clinic.order.OrderDtos.PatientItem;
import com.clinic.order.OrderDtos.PatientOrder;
import java.math.BigDecimal;
import java.security.SecureRandom;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class OrderService {

    /** Bỏ các ký tự dễ nhầm (0/O, 1/I/L) để đọc mã qua điện thoại không sai. */
    private static final char[] CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789".toCharArray();
    private static final int CODE_LENGTH = 6;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final OrderRepository orderRepository;
    private final MedicineRepository medicineRepository;
    private final ProfileRepository profileRepository;
    private final CartService cartService;
    private final com.clinic.notification.NotificationService notificationService;

    // ===== Patient =====

    @Transactional
    public PatientOrder create(UUID profileId, CreateRequest req) {
        var order = new Order();
        order.setProfileId(profileId);

        var total = BigDecimal.ZERO;
        for (var line : req.items()) {
            var medicine = medicineRepository.findByIdAndDeletedAtIsNull(line.medicineId())
                .filter(Medicine::isVisibleInStore)
                .orElseThrow(() -> ApiException.badRequest(
                    "Có thuốc trong giỏ hiện không còn bán — vui lòng xóa khỏi giỏ và thử lại"));

            var item = new OrderItem();
            item.setMedicineId(medicine.getId());
            item.setMedicineName(medicine.getName());   // snapshot (D11)
            item.setQuantity(line.quantity());
            item.setCostPrice(medicine.getCostPrice()); // snapshot
            item.setSalePrice(medicine.getSalePrice()); // snapshot
            order.getItems().add(item);

            total = total.add(medicine.getSalePrice()
                .multiply(BigDecimal.valueOf(line.quantity())));
        }
        order.setTotalAmount(total);
        order.setPickupCode(generateUniqueCode());

        var saved = orderRepository.save(order);
        cartService.clear(profileId); // đã đặt xong thì dọn giỏ DB

        var buyerName = profileRepository.findById(profileId)
            .map(p -> p.getFullName() != null ? p.getFullName() : "Khách hàng")
            .orElse("Khách hàng");
        notificationService.notify(
            com.clinic.notification.Notification.TYPE_NEW_ORDER,
            "🛒 Đơn hàng mới: " + saved.getPickupCode(),
            buyerName + " — " + saved.getItems().size() + " loại thuốc, tổng "
                + saved.getTotalAmount() + "đ",
            "/doctor/orders");

        return toPatient(saved);
    }

    @Transactional(readOnly = true)
    public Page<PatientOrder> listMine(UUID profileId, int page, int size) {
        return orderRepository
            .findByProfileIdAndDeletedAtIsNullOrderByCreatedAtDesc(
                profileId, PageRequest.of(page, Math.min(size, 50)))
            .map(this::toPatient);
    }

    /** Patient chỉ hủy được đơn của CHÍNH MÌNH và khi còn PENDING. */
    @Transactional
    public PatientOrder cancelMine(UUID profileId, UUID orderId) {
        var order = orderRepository.findByIdAndProfileIdAndDeletedAtIsNull(orderId, profileId)
            .orElseThrow(() -> ApiException.notFound("Không tìm thấy đơn hàng"));
        if (order.getStatus() != OrderStatus.PENDING) {
            throw ApiException.conflict("Đơn đã được xử lý, liên hệ phòng khám để hủy");
        }
        order.setStatus(OrderStatus.CANCELLED);
        return toPatient(orderRepository.save(order));
    }

    // ===== Doctor =====

    @Transactional(readOnly = true)
    public Page<DoctorOrder> listForDoctor(OrderStatus status, String code, int page, int size) {
        var pageable = PageRequest.of(page, Math.min(size, 100));

        if (code != null && !code.isBlank()) {
            // Tra mã nhận hàng là tra chính xác — trả page 0 hoặc 1 phần tử
            var found = orderRepository.findByPickupCodeIgnoreCaseAndDeletedAtIsNull(code.trim())
                .map(this::toDoctor)
                .map(List::of)
                .orElse(List.of());
            return new PageImpl<>(found, pageable, found.size());
        }

        var orders = (status == null)
            ? orderRepository.findByDeletedAtIsNullOrderByCreatedAtDesc(pageable)
            : orderRepository.findByStatusAndDeletedAtIsNullOrderByCreatedAtDesc(status, pageable);
        return orders.map(this::toDoctor);
    }

    @Transactional
    public DoctorOrder updateStatus(UUID orderId, OrderStatus next) {
        var order = orderRepository.findByIdAndDeletedAtIsNull(orderId)
            .orElseThrow(() -> ApiException.notFound("Không tìm thấy đơn hàng"));
        if (!order.getStatus().canTransitionTo(next)) {
            throw ApiException.conflict(
                "Không thể chuyển từ " + order.getStatus() + " sang " + next);
        }
        order.setStatus(next);
        return toDoctor(orderRepository.save(order));
    }

    // ===== Helpers =====

    private String generateUniqueCode() {
        for (int attempt = 0; attempt < 10; attempt++) {
            var sb = new StringBuilder(CODE_LENGTH);
            for (int i = 0; i < CODE_LENGTH; i++) {
                sb.append(CODE_CHARS[RANDOM.nextInt(CODE_CHARS.length)]);
            }
            var code = sb.toString();
            if (!orderRepository.existsByPickupCode(code)) return code;
        }
        throw new IllegalStateException("Không sinh được mã nhận hàng duy nhất");
    }

    private PatientOrder toPatient(Order o) {
        return new PatientOrder(o.getId(), o.getPickupCode(), o.getStatus(),
            o.getTotalAmount(), o.getCreatedAt(),
            o.getItems().stream()
                .map(i -> new PatientItem(i.getMedicineName(), i.getQuantity(), i.getSalePrice()))
                .toList());
    }

    private DoctorOrder toDoctor(Order o) {
        var buyer = profileRepository.findById(o.getProfileId()).orElse(null);
        return new DoctorOrder(o.getId(), o.getPickupCode(), o.getStatus(),
            o.getTotalAmount(), o.getCreatedAt(),
            buyer != null ? buyer.getFullName() : null,
            buyer != null ? buyer.getPhone() : null,
            o.getItems().stream()
                .map(i -> new DoctorItem(i.getMedicineName(), i.getQuantity(),
                    i.getCostPrice(), i.getSalePrice()))
                .toList());
    }
}
